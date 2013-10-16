var	mongoose	=	require('mongoose');
var	Schema		=	mongoose.Schema;
var	ObjectId	=	Schema.ObjectId;
var Subreddit   =   require('./Subreddit');

var	userSchema = new Schema({
    username: String,
    token: String,
    token_secret: String,
    profile: {
        id:  String
    },
    subscribedTo: [{type: ObjectId, ref: 'Subreddit'}],
    lastUpdated: {type: Date, default: Date.now}
});

module.exports = mongoose.model('User', userSchema);
