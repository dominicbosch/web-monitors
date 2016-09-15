'use strict';

const fs = require('fs');
const twitter = require('twitter');
const firebase = require('firebase');

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

	/* 
	 * Persists a post
	 */
	function persistArticle(id) {
	}

	let id = 0;
	twitterStream.stream('statuses/filter', { track:'data science,data visualization,big data,nodejs,node.js,realtime,nosql,firebase' }, function(stream) {
		stream.on('data', function(data) {
			if(data.user) {
				db.ref(dbkey+'/posts/'+id).set({
					ts: (new Date()).getTime(), // should be UTC no matter where
					user: data.user.name,
					tid: data.id_str,
					msg: data.text
				});
				id = (id + 1) % 100;
			}
		});
	});

} catch(err) {
	console.error('Unable to parse Twitter Auth file!');
	process.exit(1);
}
