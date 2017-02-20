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
		'data visualization',
		'nodejs',
		'firebase',
		'big data',
		'node.js',
		'nosql',
		'realtime'
	];
	let today = new Date();
	let id = 0;
	let count = 0;
	let countFrame = 0;
	let iFilter = 1;
	let twitterStream;
	let arrStreams = [];

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
	function updateStream(num) {
		if(iFilter <= arrTwitterFilters.length) {
			let fltrs = arrTwitterFilters.slice(0, iFilter).join(',');
			if(twitterStream) twitterStream.destroy();
			setTimeout(() => {
				twitterApp.stream('statuses/filter', { track: fltrs }, processStream);
				console.log((new Date()).toISOString()
					+' | Starting new twitter stream with filters "'+fltrs+'"'
					+ (num ? ', because we counted '+num+' in 60 seconds' : '')
				);
			}, 1000)
		} else console.log('Reached maximum available streams! ('+iFilter+')')
	}
	function processStream(stream) {
		twitterStream = stream;
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
				countFrame++;
				if(now.getDate() !== today.getDate()) {
					console.log(getDateString(today)+': '+count+' entries stored');
					today = now;
					count = 0;
				}
				id = (id + 1) % 100;
			}
		});

		stream.on('error', console.log);
	}
	console.log('Starting Twitter Stream relay at '+today+' with PID #'+process.pid);
	updateStream();
	setInterval(() => {

		// if less than six posts in 60 seconds arrived, we add one filter
		if(countFrame < 6) {
			iFilter++;
			updateStream(countFrame);

		// if more than thirty posts in 60 seconds arrived, we remove one filter
		} else if(countFrame > 30) {
			iFilter--;
			updateStream(countFrame);
		}
		countFrame = 0;
	}, 60000);

} catch(err) {
	console.error(err.stack);
	process.exit(1);
}
