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
    var upvoter = $(this);
    var parent_row = $($(this).closest('.row[id]'))[0];
    var thread_id = ($(parent_row).attr('id'));

    if(upvoter.hasClass('liked'))
    {
        $.ajax({
            type: "POST",
            url: "/unvote/thread/"+ thread_id +"/",
            success: function() {
                upvoter.removeClass('liked', 400);
                $('#'+ thread_id +' .score').removeClass('liked', 400);
            }
        });
    }
    else {
        $.ajax({
            type: "POST",
            url: "/upvote/thread/"+ thread_id +"/",
            success: function() {
                upvoter.addClass('liked', 400);
                $('#'+ thread_id +' .downvote').removeClass('disliked', 400);
                $('#'+ thread_id +' .score').removeClass('disliked', 400);
                $('#'+ thread_id +' .score').addClass('liked', 400);
            }
        })
    }
})

$('span.downvote').on('click', function() {
    var downvoter = $(this);
    var parent_row = $($(this).closest('.row[id]'))[0];
    var thread_id = ($(parent_row).attr('id'));
    if(downvoter.hasClass('disliked'))
    {
        $.ajax({
            type: "POST",
            url: "/unvote/thread/"+ thread_id +"/",
            success: function() {
                downvoter.removeClass('disliked', 400);
                $('#'+ thread_id +' .score').removeClass('disliked', 400);
            }
        });
    }
    else {
        $.ajax({
            type: "POST",
            url: "/downvote/thread/"+ thread_id +"/",
            success: function() {
                downvoter.addClass('disliked', 400);
                $('#'+ thread_id +' .upvote').removeClass('liked', 400);
                $('#'+ thread_id +' .score').removeClass('liked', 400);
                $('#'+ thread_id +' .score').addClass('disliked', 400);
            }
        })
    }
})