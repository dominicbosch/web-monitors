'use strict';

console.log('Starting data mining at '+(new Date())+' with PID #'+process.pid);

// Requires modules: cheerio, needle and firebase <br>
const cheerio = require('cheerio');
const needle = require('needle');
const firebase = require('firebase');

const baseURI = 'http://www.watson.ch/';
const apiURI = baseURI+'api/1.0/';
const interval = 10*60*1000; // every ten minutes
const duration = 5*24*60*60*1000; // measure for five days for each article
const articleIndex = {}; // index of currently tracked articles and their comments

// the current day represents all the measurements of the current day
let currentDay;

firebase.initializeApp({
	databaseURL: 'https://data-mining-44c9c.firebaseio.com/',
	serviceAccount: '.credentials'
});

const db = firebase.database(); // We use firebase as a DB


/* 
 * Persists an article index. We do it ID-wise in order to save computation
 */
function persistArticle(id) {
	db.ref('/article-index/'+id).set(articleIndex[id]);
}

/* 
 * Persists a comment
 */
function persistComments(id, obj) {
	// a day stamp at the beginning of the day under which all measurements of this day are stored
	let daystamp = (new Date()).setHours(0, 0, 0, 0);
	let refToday = db.ref('/article-history/'+daystamp);

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
function unleakString(s) { return (' ' + s).substr(1); }

exports.checkArticles = function() {
	console.log('['+(new Date()).getTime()+'] Checking articles');
	let articleSelector = '.teaser';

	needle.get(baseURI, function(err, resp) {
		if(err) console.error('Error fetching "'+baseURI+'": '+err.message);
		else {
			let tree = cheerio.load(resp.body);
			tree(articleSelector).each(function(i) {
				let id = unleakString(tree(this).attr('data-story-id'));
				if(id !== 'undefined') {
					if(!articleIndex[id]) {
						articleIndex[id] = {
							id: id,
							title: null, // title will be added later in the next statement
							link: null,  // link will be added later in the next statement
							tags: null,  // tags will be added later in the next statement
							showup: (new Date()).getTime(),
							comments: {}
						};
						needle.get(apiURI+'articles.json?id='+id, function(err, resp) {
							if(err) console.error('Error fetching article id "'+id+'": '+err.message);
							else {
								try {
									// Cheerio already parsed the JSON, yay! Accessing it without parsing
									let oArt = resp.body.items.Article;
									// Fetch the title for the article
									articleIndex[id].title = oArt.title;
									// Fetch the link for the article
									articleIndex[id].link = oArt.link;
									// Fetch all the tags for the article
									articleIndex[id].tags = oArt.tags.map(function(o) { return o.name });

									// now that we have all the tags for the article we can finally store it to firebase
									persistArticle(id);
								} catch(e) {
									console.error('Error fetching article "'+id+'": '+e);
								}
							}
						});
					}
					let article = articleIndex[id];
					if(!article.ended) {
						if(((new Date()).getTime()-article.showup) > duration) {
							// We only track changes for a certain duration
							// after this we remove the whole article object from the memory to save some space
							articleIndex[id] = { ended: true };
						} else {
							// random delay up to two thirds of the interval to spread the requests a bit over time
							setTimeout(function() { getComments(article) }, Math.random()*interval*2/3);
						}
					}
				}
			});
			tree = null;
		}
	});
}

function getComments(oArticle, retry) {
	let id = oArticle.id;
	console.log('['+(new Date()).getTime()+'] Fetching comments for article '+id);
	if(retry) console.log('Retrying article '+id);
	needle.get(apiURI+'comments.json?id='+id, function(err, resp) {
		if(err) console.error('Error fetching comments for article id "'+id+'": '+err.message);
		else {
			try {
				let arrComm = resp.body.items.Comments;	// the new comments from the webapi
				let comments = oArticle.comments;
				let measurement = {
					timestamp: (new Date()).getTime(),
					// here below it gets complicated as we update the index structure as well as a measurement point ;)
					comments: arrComm.filter(function(o) {
							let commIdx = oArticle.comments[o.id];
							// If either not yet existing, or different upvote count, or different downvote count
							// i.e. we only store deltas (events)
							if(!commIdx || commIdx.upvotes!==o.love || commIdx.downvotes!==o.hate) {
								if(!commIdx) commIdx = oArticle.comments[o.id] = {};
								commIdx.text = o.comment;
								commIdx.upvotes = o.love;
								commIdx.downvotes = o.hate;
								return true;
							}
							// We dont store this comment and thus also don't update the article index
							else return false;
						})
						.map(function(o) { return {
							id: o.id,
							upvotes: o.love,
							downvotes: o.hate
						}})
				};
				// We only persist things if we really had a measurement
				if(measurement.comments.length > 0) {
					persistArticle(id);
					persistComments(id, measurement);
				}
			} catch(e) {
				console.error(id+': '+e);
				// We only retry once
				if(!retry) getComments(id, true);
			}
		}
	});

}

// Finally execute first and then set an interval as defined
exports.checkArticles();
setInterval(exports.checkArticles, interval);


