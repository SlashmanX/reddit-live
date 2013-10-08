
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var request = require('request');
var JSONStream = require('JSONStream');
var es = require('event-stream');
var browserify = require('browserify');
var browserijade = require('browserijade');
var connect = require('connect');
var MemoryStore = express.session.MemoryStore;
var sessionStore = new MemoryStore();


var app = express();
var server = http.Server(app);
var io = require('socket.io').listen(server);

var Session = connect.middleware.session.Session;
io.set('authorization', function (data, accept) {
    if (data.headers.cookie) {
        data.cookie = connect.utils.parseSignedCookies(require('cookie').parse(decodeURIComponent(data.headers.cookie)),'monkey');
        data.sessionID = data.cookie['express.sid'];
        // save the session store to the data object
        // (as required by the Session constructor)
        data.sessionStore = sessionStore;
        sessionStore.get(data.sessionID, function (err, session) {
            if (err || !session) {
                accept('Error', false);
            } else {
                // create a session object, passing data as request and our
                // just acquired session data
                data.session = new Session(data, session);
                accept(null, true);
            }
        });
    } else {
        return accept('No cookie transmitted.', false);
    }
});


io.on('connection', function (socket) {
    // do all the session stuff
    socket.join(socket.handshake.sessionID);
    socket.on('subscribe', function(data) {
        socket.join(data.room)
    });
    // socket.io will leave the room upon disconnect
});

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
var bundle = browserify().use(browserijade(__dirname +'/views/partials'));
bundle.addEntry(__dirname +'/public/javascripts/app.js');
app.use(bundle);


app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser())
app.use(express.session({store: sessionStore, secret: 'monkey', key: 'express.sid'}))
app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public', compress: true, optimization: 2 }));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/r/:subreddit/', function(req, res) {
    io.sockets.clients(req.sessionID).join(req.params.subreddit);
    res.render('index', { title: req.params.subreddit, subreddit: req.params.subreddit });
})
app.get('/r/:subreddit/comments/:topicid/:topicname?/*', function(req, res) {
    io.sockets.clients(req.sessionID).join(req.params.subreddit);
    res.render('index', { title: req.params.subreddit, topic: req.params.topicid });
})

var parser = JSONStream.parse() //emit parts that match this path (any element of the rows array)
var req = request({url: 'http://stream.redditanalytics.com'})
var logger = es.mapSync(function (data) {
    io.sockets.in(data.subreddit).emit('comment', {comment: data});
    io.sockets.in(data.link_id.replace('t3_', '')).emit('comment', {comment: data});
})

req.pipe(parser)
parser.pipe(logger);

server.listen(app.get('port'));