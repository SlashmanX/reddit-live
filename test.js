var request = require('request')
    , JSONStream = require('JSONStream')
    , es = require('event-stream')

var parser = JSONStream.parse() //emit parts that match this path (any element of the rows array)
    , req = request({url: 'http://stream.redditanalytics.com/?subreddit=AskReddit'})
    , logger = es.mapSync(function (data) {  //create a stream that logs to stderr,
        console.error(data)
        return data
    })

req.pipe(parser)
parser.pipe(logger)

req.on('data', function(data) {
    data = JSON.parse(data);
    if(data.subreddit == "AskReddit")
        console.log(data);
})