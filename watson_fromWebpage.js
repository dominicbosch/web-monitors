'use strict';

console.log('Starting data mining at '+(new Date())+' with PID #'+process.pid);

// Requires modules: cheerio, needle and firebase <br>
const cheerio = require('cheerio');
const needle = require('needle');
const firebase = require('firebase');
const moment = require('moment');

const baseURI = 'http://www.watson.ch/';
const interval = 1*60*1000; // every ten minutes
const duration = 5*24*60*60*1000; // measure for five days for each article

const theBeginning = (new Date()).getTime();

// index of currently tracked articles and their comments
let articleIndex;
// the current day represents all the measurements of the current day
let currentDay;

firebase.initializeApp({
	databaseURL: 'https://data-mining-44c9c.firebaseio.com/',
	serviceAccount: '.credentials'
});

const db = firebase.database(); // We use firebase as a DB
const dbkey = '/watson';

//
// PURGE ALL DATA:
// db.ref(dbkey).child('/article-index/').remove();
// db.ref(dbkey).child('/article-history/').remove();
//

/* 
 * Persists an article index. We do it ID-wise in order to save computation
 */
function persistArticle(id) {
	db.ref(dbkey+'/article-index/'+id).set(articleIndex[id]);
}

/* 
 * Persists a comment
 */
function persistComments(id, obj) {
	// a day stamp at the beginning of the day under which all measurements of this day are stored
	let daystamp = (new Date()).setHours(0, 0, 0, 0);
	let refToday = db.ref(dbkey+'/article-history/'+daystamp);

	function updateCurrentDay() {
		if(!currentDay.data[id]) currentDay.data[id] = [];
		currentDay.data[id].push(obj);
		refToday.set(currentDay.data);
	}

	if(!currentDay || currentDay.daystamp !== daystamp) {
		// Retrieve the existing day (eventually we should keep it in memory...)
		refToday.once('value', function(dataSnapshot) {
			// if day exists we use it as object or otherwise we create a new object
			currentDay = {
				daystamp: daystamp,
				data: dataSnapshot.exists() ? dataSnapshot.val() : {}
			};
			updateCurrentDay();
		});
	}
	else updateCurrentDay();
}


/* IMPORTANT! When using cheerio you need unealkString... */
function unleakString(s) { return (' '+s).substr(1); }

exports.checkArticles = function() {
	let dt = (new Date()).getTime();

	let mem = process.memoryUsage();
	// console.log('MEMUSAGE (MB): '+mem.heapUsed/1000/1000);
	console.log('['+dt+'] Checking articles, next check at '+(new Date(dt+interval)));

	needle.get(baseURI, function(err, resp) {
		if(err) console.error('Error fetching "'+baseURI+'": '+err.message);
		else {
			let tree = cheerio.load(resp.body);
			tree('.teaser').each(function(i, o) {
				let id = unleakString(o.attribs['data-story-id']);
				if(id !== 'undefined') {
					if(!articleIndex[id]) {
						articleIndex[id] = {
							id: id,
							link: baseURI+'!'+id,
							title: null, // title will be added later in the next statement
							tags: null,  // tags will be added later in the next statement
							showup: (new Date()).getTime()
						};
					}
					let article = articleIndex[id];
					if(!article.ended) {
						if(((new Date()).getTime()-article.showup) > duration) {
							// We only track changes for a certain duration
							// after this we remove the whole article object from the memory to save some space
							if(articleIndex[id])
							articleIndex[id] = { ended: true };
						} else {
							// random delay up to two thirds of the interval to spread the requests a bit over time
							setTimeout(function() { getComments(article) }, Math.random()*interval*2/3);
						}
					}
				}
			});
		}
	});
}

function getComments(oArticle, retry) {
	let id = oArticle.id;
	
	let dt = (new Date()).getTime();
	let mem = process.memoryUsage();
	console.log('MEMUSAGE (MB)	'+((dt-theBeginning)/1000)+'	'+mem.heapUsed/1000/1000);

	console.log('['+dt+'] Fetching comments for article '+id);
	if(retry) console.log('Retrying article '+id);

	needle.get(baseURI+'!'+id, function(err, resp) {
		if(err) console.error('Error fetching "'+baseURI+'!'+id+'": '+err.message);
		else {
			try {
				let tree = cheerio.load(resp.body);
				let needsUpdate = false;

				// First fetch some more information about the article
				if(!articleIndex[id].title) {
					articleIndex[id].title = unleakString(tree('h2.maintitle').text());
					needsUpdate = true;
				} 
				if(!articleIndex[id].tags) {
					articleIndex[id].tags = unleakString(tree('[name="news_keywords"]').attr('content')).split(', ');
					needsUpdate = true;
				}
				
				let ts = (new Date()).getTime();
				if(!oArticle.comments) oArticle.comments = {};
				let arrComments = [];

				tree('ul.timeline > li').each(function(i, o) {
					let commentEl = tree(o);
					let id = o.attribs['id'].substr(8);
					if(!oArticle.comments[id]) oArticle.comments[id] = {};
					let commIdx = oArticle.comments[id];
					if(!commIdx.text) {
						let content = commentEl.find('> .text > .content');
						content.find('span').remove();
						commIdx.text = unleakString(content.text().trim());
					}
					if(!commIdx.showup) {
						let pub = moment(unleakString(commentEl.find('> .text > .commentdate').text()), 'dd.MM.yyyy HH:mm');
						commIdx.showup = ts;
						commIdx.published = pub.valueOf();
						commIdx.delay = ts - pub.valueOf();
					}

					let upvotes = parseInt(unleakString(commentEl.find('> .text > .tools > .love').text()));
					let downvotes = parseInt(unleakString(commentEl.find('> .text > .tools > .hate').text()));
					commIdx.uv = upvotes;
					commIdx.dv = downvotes;
					arrComments.push({
						id: id,
						uv: upvotes,
						dv: downvotes
					});
				})
				tree = null;

				let state = {
					ts: ts,
					comm: arrComments,
					num: arrComments.length
				};
				if(needsUpdate) persistArticle(id);
				persistComments(id, state);

			} catch(e) {
				console.error('ERROR['+id+']: '+e);
				// We only retry once
				if(!retry) getComments(id, true);
			}
		}
	});
}

// Let's check for an existing index and load it if found
db.ref(dbkey+'/article-index').once('value', function(dataSnapshot) {
	// if day exists we use it as object or otherwise we create a new object
	articleIndex = dataSnapshot.exists() ? dataSnapshot.val() : {};

	// Finally execute first and then set an interval as previously defined
	exports.checkArticles();
	setInterval(exports.checkArticles, interval);
});


