# Proposed data structure for data mining at news sites

Since we intend to store data over long time we need to keep as few data as possible in memory in the index structure. But since we do only store events (change in the data) we need to keep a state in memory in order to derive a change.

## INDEX STRUCTURE:
Will also be kept in memory and removed from there if article is not monitored/existing anymore.

```json
{
	"100104638": {
		"id": "100104638",
		"title": "Der Neoliberalismus hat ein neues politisches Monster gezeugt: Das Prekariat",
		"link": "http:\/\/www.watson.ch\/!431211413",
		"tags": [ "Schweiz", "Migration" ],
		"showup": 1464235183678,
		"comments": {
			"23456789": { "text": "some comment", "upvotes": 1, "downvotes": 2 },
			"9876543": { "text": "some other comment", "upvotes": 3, "downvotes": 1 }
		}
	}
}
```



## HISTORY STRUCTURE (by day):

daily data point, article as property within day. Article title change?
Articles will only show up if they changed during that day.

```json
{
	"1465941600000": {
		"...": "..."
	},
	"1466028000000": {
		"100104638": [{
			"timestamp": 1464235609476,
			"title": "[optional if changed?]",
			"comments": [
				{ "id": 2323, "upvotes": 1, "downvotes": 2 },
				{ "id": 4573, "upvotes": 10, "downvotes": 20 }
			]
		}]
	},
	"...": "..."
}
```

```sql
SELECT FROM datatable;
```


