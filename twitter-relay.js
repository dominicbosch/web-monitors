'use strict';

const fs = require('fs');
const twitter = require('twitter');
const firebase = require('firebase');

const twitterFilter = { track:'data science,data visualization' };

try {
	let twitterStream = new twitter(JSON.parse(fs.readFileSync('.twitterauth')));

	firebase.initializeApp({
		databaseURL: 'https://data-mining-44c9c.firebaseio.com/',
		serviceAccount: '.credentials'
	});

	console.log('Starting Twitter Stream relay at '+(new Date())+' with PID #'+process.pid);

	const db = firebase.database(); // We use firebase as a DB
	const dbkey = '/twitter';

	// PURGE ALL DATA:
	// db.ref(dbkey).child('/posts/').remove();

	function zeroFill(num) {
		let str = num+'';
		if(str.length === 1) return 0+str;
		else return str;
	}
	let today = new Date();
	let lastUpdate;
	let id = 0;
	let count = 0;
	twitterStream.stream('statuses/filter', twitterFilter, function(stream) {
		stream.on('data', function(data) {
			if(data.user) {
				let now = new Date(); // should be UTC no matter where
				// Store new entry @id
				db.ref(dbkey+'/posts/'+id).set({
					ts: now.getTime(),
					user: data.user.name,
					tid: data.id_str,
					msg: data.text
				});
				count++;
				if(now.getDate() !== today.getDate()) {
					let dt = now.getFullYear()+'-'+(zeroFill(now.getMonth()+1))+'-'+zeroFill(now.getDate());
					console.log(dt+': '+count+' entries stored');
					today = now;
					count = 0;
				}
				id = (id + 1) % 100;
			}
		});
	});

} catch(err) {
	console.error('Unable to parse Twitter Auth file!');
	process.exit(1);
}
