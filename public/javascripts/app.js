window.require = require;
var browserijade = require('browserijade');

socket.on('connect', function() {
    if(subreddit)
        socket.emit('subscribe', {room: subreddit});
    if(topic)
        socket.emit('subscribe', {room: topic.id});
})

socket.on('comment', function(data) {
    if(!$('#'+data.comment.id).length) {
        data.comment.link_id = data.comment.link_id.replace('t3_', '');
        var newComment = browserijade("comment", {comment: data.comment});

        $(newComment).hide().prependTo('.comments-space').fadeIn("fast");
    }
})

$('span.upvote').on('click', function() {
    var parent_row = $($(this).closest('.row[id]'))[0];
    var thread_id = ($(parent_row).attr('id'));

    $.ajax({
        type: "POST",
        url: "/upvote/thread/"+ thread_id +"/",
        success: function() {
            console.log('upvoted');
        }
    })
})

$('span.downvote').on('click', function() {
    var parent_row = $($(this).closest('.row[id]'))[0];
    var thread_id = ($(parent_row).attr('id'));

    $.ajax({
        type: "POST",
        url: "/downvote/thread/"+ thread_id +"/",
        success: function() {
            console.log('downvoted');
        }
    })
})