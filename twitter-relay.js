'use strict';

const fs = require('fs');
const twitter = require('twitter');
const firebase = require('firebase-admin');

const twitterAuth = require('./.twitterauth.json');
const firebaseAuth = require('./.credentials.json');
try {
	let twitterApp = new twitter(twitterAuth);

	firebase.initializeApp({
		databaseURL: 'https://data-mining-44c9c.firebaseio.com/',
		credential: firebase.credential.cert(firebaseAuth),
	});


	const db = firebase.database(); // We use firebase as a DB
	const dbkey = '/twitter';

	const arrTwitterFilters = [
		'data science',
		'data visualization'
	];
	let today = new Date();
	let id = 0;
	let count = 0;
	let countFrame = 0;
	let iFilter = 0;
	let twitterStream;

	// PURGE ALL DATA:
	// db.ref(dbkey).child('/posts/').remove();

	function zeroFill(num) {
		let str = num+'';
		if(str.length === 1) return 0+str;
		else return str;
	}
	function getDateString(dt) {
		return dt.getFullYear()+'-'+(zeroFill(dt.getMonth()+1))+'-'+zeroFill(dt.getDate());
	}
	function addFilter() {
		if(iFilter < arrTwitterFilters.length) {
			let fltr = arrTwitterFilters[iFilter++];
			let filter = { track: fltr };
			arrStreams.push(twitterApp.stream('statuses/filter', filter, processStream));
			console.log('Starting new twitter stream with filter "'+fltr+'"')
		} else console.log('Reached maximum available streams! ('+iFilter+')')
	}
	function removeFilter() {
		arrStreams.pop().destroy();
		iFilter--;
	}
	function processStream(stream) {
		twitterStream = stream;
		console.log(stream);
		stream.on('data', function(data) {
			if(data.user) {
				console.log(data.user.name);
				let now = new Date(); // should be UTC no matter where
				// Store new entry @id
				db.ref(dbkey+'/posts/'+id).set({
					ts: now.getTime(),
					user: data.user.name,
					tid: data.id_str,
					msg: data.text
				});
				count++;
				countFrame++;
				if(now.getDate() !== today.getDate()) {
					console.log(getDateString(today)+': '+count+' entries stored');
					today = now;
					count = 0;
				}
				id = (id + 1) % 100;
			}
		});

		stream.on('error', function(data) { console.log(data); });
	}
	console.log('Starting Twitter Stream relay at '+today+' with PID #'+process.pid);
	addFilter();
	setInterval(() => {
		if(countFrame < 5) addFilter();
		else if(countFrame > 20) removeFilter();
		countFrame = 0;
	}, 30000);

} catch(err) {
	console.error(err.stack);
	process.exit(1);
}
