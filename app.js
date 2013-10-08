
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
var passport = require('passport');
var RedditStrategy = require('passport-reddit').Strategy;
var crypto = require('crypto')

var REDDIT_CONSUMER_KEY = "4b0oH04c0BHiOw";
var REDDIT_CONSUMER_SECRET = "YpPpKwxnhm4Rqlvq4lSTvikItAE";


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


passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

passport.use(new RedditStrategy({
        clientID: REDDIT_CONSUMER_KEY,
        clientSecret: REDDIT_CONSUMER_SECRET,
        callbackURL: "http://localhost:3000/auth/reddit/callback/"
    },
    function(accessToken, refreshToken, profile, done) {
        process.nextTick(function () {
            return done(null, profile);
        });
    }
));
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
app.use(express.cookieParser());
app.use(express.session({store: sessionStore, secret: 'monkey', key: 'express.sid'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public', compress: true, optimization: 2 }));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', function(req, res) {
    getActiveThreads(function(err, data) {
        var active = data.data.data;
        console.log(req.user);
        res.render('home', {title: 'Home', activeThreads: active, user: req.user });
    })
});
app.get('/r/:subreddit/', function(req, res) {
    res.render('stream', { title: req.params.subreddit, subreddit: req.params.subreddit, user: req.user });
});

app.get('/r/:subreddit/comments/:topicid/:topicname?/*', function(req, res) {
    if(req.params.topicid.substring(0,3) == 't3_')
        res.redirect('/r/'+ req.params.subreddit+'/comments/'+ req.params.topicid.replace('t3_', '')+'/');
    else
        res.render('stream', { title: req.params.subreddit, topic: req.params.topicid, user: req.user });
});

app.get('/auth/reddit/', function(req, res, next){
    req.session.state = crypto.randomBytes(32).toString('hex');
    passport.authenticate('reddit', {
        state: req.session.state,
        duration: 'permanent',
        scope: 'identity,mysubreddits,submit,vote,read'
    })(req, res, next);
});

app.get('/auth/reddit/callback/', function(req, res, next){
    // Check for origin via state token
    if (req.query.state == req.session.state){
        passport.authenticate('reddit', {
            successRedirect: '/',
            failureRedirect: '/login/'
        })(req, res, next);
    }
    else {
        next( new Error(403) );
    }
});

app.get('/login/', function(req, res){
    res.render('login', { user: req.user });
});

app.get('/logout/', function(req, res){
    req.logout();
    res.redirect('/');
});

var parser = JSONStream.parse() //emit parts that match this path (any element of the rows array)
var req = request({url: 'http://stream.redditanalytics.com'})
var logger = es.mapSync(function (data) {
    io.sockets.in(data.subreddit).emit('comment', {comment: data});
    io.sockets.in(data.link_id.replace('t3_', '')).emit('comment', {comment: data});
})

req.pipe(parser)
parser.pipe(logger);

server.listen(app.get('port'));

function getActiveThreads(callback) {
    request('http://api.redditanalytics.com/getmostactivethreads?limit=25&timespan=300', function(error, res, body) {
        if(!error && res.statusCode == 200) {
            callback(null, {data: JSON.parse(body)})
        }
        else
            callback(error, null);
    })
}