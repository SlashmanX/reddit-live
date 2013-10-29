var	mongoose	=	require('mongoose');
var	Schema		=	mongoose.Schema;
var	ObjectId	=	Schema.ObjectId;

var	subredditSchema = new Schema({
    id: String,
    name: String,
    description: String,
    over18: Boolean,
    link: String,
    lastUpdated: { type : Date, default: Date.now }
});

module.exports = mongoose.model('Subreddit', subredditSchema);
