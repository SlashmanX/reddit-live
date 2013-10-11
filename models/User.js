var	mongoose	=	require('mongoose');
var	Schema		=	mongoose.Schema;
var	ObjectId	=	Schema.ObjectId;

var	userSchema = new Schema({
    username: String,
    token: String,
    token_secret: String,
    profile: {
        id:  String
    }
});

module.exports = mongoose.model('User', userSchema);
