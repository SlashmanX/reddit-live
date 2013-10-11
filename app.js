
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
var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var server_config = new Server('localhost', 27017, {auto_reconnect: true, native_parser: true});
var db =   new Db('reddit-live', server_config, {});
var MongoStore  =  require('connect-mongodb');
var passport = require('passport');
var RedditStrategy = require('passport-reddit').Strategy;
var crypto = require('crypto');
var mongoose = require('mongoose');
var marked = require('marked');
var expose = require('express-expose');

var User = require('./models/User.js');

var REDDIT_CONSUMER_KEY = "4b0oH04c0BHiOw";
var REDDIT_CONSUMER_SECRET = "YpPpKwxnhm4Rqlvq4lSTvikItAE";

var ACTIVE_THREAD_TIME_LIMIT = 300 // 5 minutes


var app = express();
var server = http.Server(app);
var io = require('socket.io').listen(server);

mongoose.connect('mongodb://localhost/reddit-live');

var Session = connect.middleware.session.Session;
io.set('authorization', function (data, accept) {
    if (data.headers.cookie) {
        data.cookie = require('cookie').parse(data.headers.cookie);

        console.log(data.cookie);
        data.sessionID = data.cookie['express.sid'].split('.')[0];
        console.log(data.sessionID);
    } else {
        return accept('No cookie transmitted.', false);
    }
    return accept(null, true);
});


io.on('connection', function (socket) {
    // do all the session stuff
    //socket.join(socket.handshake.sessionID);
    socket.on('subscribe', function(data) {
        socket.join(data.room)
    });
    // socket.io will leave the room upon disconnect
});


// Serialize
passport.serializeUser(function(user, done) {
    console.log('srz: '+ user);
    done(null, user._id);
});

// Deserialize
passport.deserializeUser(function(id, done) {
    User.findOne({ _id: id }).exec(function(err, user) {
        console.log('desrz:' + user);
        done(err, user);
    });
});

passport.use(new RedditStrategy({
        clientID: REDDIT_CONSUMER_KEY,
        clientSecret: REDDIT_CONSUMER_SECRET,
        callbackURL: "http://localhost:3000/auth/reddit/callback/"
    },
    function(accessToken, refreshToken, profile, done) {
        User.findOne({'profile.id' : profile.id},
            function(err, user) {
                if (!err && user != null) {
                    console.log('returning user');
                    user.token = accessToken;
                    user.token_secret = refreshToken;
                    user.save(function(err) {
                        if (err) console.log(err);
                        else console.log('Saving new access token to user...');
                    })
                    return done(null, user);
                } else {
                    console.log(profile);
                    var user = new User({
                        'profile.id': profile.id,
                        username: profile.name,
                        token: accessToken,
                        token_secret: refreshToken
                    });
                    user.save(function(err) {
                        if (err) console.log(err);
                        else console.log('Saving user...');
                    });
                    return done(null, user);
                }
            }
        );
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
app.use(express.cookieParser('I am not wearing any pants'));
app.use(express.session({
    cookie: {
        maxAge: new Date(Date.now() + 3600000)
    },
    key: 'express.sid',
    store: new MongoStore({db: db})
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public', compress: true, optimization: 2 }));
app.use(express.static(path.join(__dirname, 'public')));
app.expose(marked, 'md');

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', function(req, res) {
    /*if(req.user) {
        getUserSubreddits({user: req.user}, function(err, data) {
            console.log(data);
        })
    }*/
    getActiveThreads({limit: 10, time: ACTIVE_THREAD_TIME_LIMIT}, function(err, data) {
        var active = data.data.data;
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
    {
        getThreadAndComments({id: req.params.topicid}, function(err, topic) {
            res.render('stream', { title: req.params.subreddit, topic: topic, user: req.user, marked: marked });
        })
    }
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
    res.render('login', {});
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

function getActiveThreads(data, callback) {

    var url = 'http://api.redditanalytics.com/getmostactivethreads?limit='+data.limit+'&timespan='+data.time;
    request({url: url, headers : {'User-Agent': 'reddit-live/0.1 by SlashmanX'}}, function(error, res, body) {
        if(!error && res.statusCode == 200) {
            callback(null, {data: JSON.parse(body)})
        }
        else
            callback(error, null);
    })
}

function getThreadAndComments(data, callback) {
    var url = 'http://www.reddit.com/comments/'+ data.id +'/.json?sort=new&limit=1500000000';

    request({url: url, headers : {'User-Agent': 'reddit-live/0.1 by SlashmanX'}}, function(error, res, body) {
        if(error) {
            callback(error, null);
        }
        else {
            var data = JSON.parse(body)
            var topic_info = data[0].data.children[0].data;
            var comments = data[1].data.children; //newest first

            var topic = {};
            topic.info = topic_info;
            topic.comments = comments;
            callback(null, topic);
        }
    })
}

function getUserSubreddits(data, callback) {
    var url = 'https://oauth.reddit.com/subreddits/mine/subscriber/.json';
    var oauth = { consumer_key: REDDIT_CONSUMER_KEY,
        consumer_secret: REDDIT_CONSUMER_SECRET,
        token: data.user.token,
        token_secret: data.user.token_secret
    }

    request({url: url, headers: {'User-Agent': 'reddit-live/0.1 by SlashmanX', 'Authorization': 'bearer '+data.user.token}}, function(error, res, body) {
        if(error) {
            callback(error, null);
        }
        else {
            var data = JSON.parse(body);
            var subs = data.data.children;
            var user_subreddits = [];
            for(var sub in subs) {
                var tmp = subs[sub];
                user_subreddits.push({id: tmp.data.id, title: tmp.data.display_name, url : tmp.data.url});
            }
            callback(null, user_subreddits);
       }
    })
}