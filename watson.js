'use strict';

console.log('Starting at '+(new Date())+' with PID #'+process.pid);

// process.on('uncaughtException', function() {
// 	console.log('uncaughtException');
// });

let fs = require('fs');
let persistenceFile = 'data/articles.json';
let articles;
try {
	articles = JSON.parse(fs.readFileSync(persistenceFile));
} catch (e) {
	log('Error reading persistence: '+e);
	articles = {};
	persist();
}
function log(msg) {
	console.log(msg);
}
function persist() {
	fs.writeFile(persistenceFile, JSON.stringify(articles));
}
function datalog(fid, o) {
	fs.appendFile(fid, JSON.stringify(o)+'\n');
}

let modules = {
	cheerio: require('cheerio'),
	needle: require('needle')
}




// Requires modules: cheerio, needle <br>

let cheerio = modules.cheerio;
let needle = modules.needle;

/* IMPORTANT! When using cheerio you need unealkString... */
function unleakString(s) { return (' ' + s).substr(1); }

exports.checkArticles = function() {
	console.log((new Date())+' Checking articles');
	let baseURI = 'http://www.watson.ch/';
	let hrefSelector = '.teaser';

	needle.get(baseURI, function(err, resp) {
		if(err) log('Error fetching "'+baseURI+'": '+err.message);
		else {
			let tree = cheerio.load(resp.body);
			let arrLinks = tree(hrefSelector);
			arrLinks.each(function(i) {
				let id = unleakString(tree(this).attr('data-story-id'));
				if(id !== 'undefined') {
					if(!articles[id]) {
						articles[id] = {
							id: id,
							href: tree('.storylink',this).attr('href'),
							showup: (new Date()).getTime(),
							numComments: []
						};
					}
					if(!articles[id].ended) {
						if((new Date()).getTime() - articles[id].showup > 5*24*60*60*1000) {
							articles[id].ended = true; // We only track changes for five days
						} else {
							// random delay up to five minutes to spread the requests a bit over time
							setTimeout(function() { getComments(id) }, Math.random()*10*60*1000);
						}
					}
					persist();
				}
			})
		}
	});
}

function getComments(id, retry) {
	log('['+(new Date()).getTime()+'] Fetching comments for article '+id);
	if(retry) log('Retrying article '+id);
	needle.get('www.watson.ch/api/1.0/comments.json?id='+id, function(err, resp) {
		if(err) log('Error fetching article id "'+id+'": '+err.message);
		else {
			try {
				let arrComm = resp.body.items.Comments;	// the new comments from the webapi
				// let oComm = articles[id].comments;		// the existing comments, internal storage
				let ts = (new Date()).getTime();
				let arr = articles[id].numComments;
				let last = arr[arr.length-1];
				if(last.num !== arrComm.length) {
					arr.push({
						timestamp: ts,
						num: arrComm.length
					});
					persist();
				}
				for (var i = 0; i < arrComm.length; i++) {
					let fileId = 'data/art-'+id.replace(/\W/g, '')
							+'_comm-'+arrComm[i].id+'.json';
					datalog(fileId, {
						timestamp: ts,
						upvotes: arrComm[i].love,
						downvotes: arrComm[i].hate
					});
				}
			} catch(e) {
				log(id+': '+e);
				if(!retry) getComments(id, true);
			}
	}
	});

}


// 20mins $('.teaser_image a').each(function(){ log($(this).attr('href'))})
// watson $('.storylink').each(function(){ log($(this).attr('href'))})

exports.checkArticles();
setInterval(exports.checkArticles, 15*60*1000);
 // every 15 minutes


