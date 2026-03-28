const Comment = require('../models/Comment');

const createComment = async ({ content, ticket, authorId }) => {
  if (!content) throw new Error('Comment content is required');

  let comment = await Comment.create({
    content,
    ticket,
    author: authorId,
  });

  comment = await comment.populate('author', 'fullname email');

  return comment;
};

const getCommentsByTicketId = async (ticketId) => {
  const comments = await Comment.find({ ticket: ticketId })
    .populate('author', 'fullname email')
    .sort({ createdAt: 1 });

  return comments;
};

const updateComment = async (commentId, { content }, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) throw new Error('Comment not found');

  if (comment.author.toString() !== userId.toString()) {
    throw new Error('Unauthorized to update this comment');
  }

  comment.content = content;
  await comment.save();

  return comment.populate('author', 'fullname email');
};

const deleteComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) throw new Error('Comment not found');

  if (comment.author.toString() !== userId.toString()) {
    throw new Error('Unauthorized to delete this comment');
  }

  await comment.deleteOne();
  return { message: 'Comment removed successfully' };
};

module.exports = {
    createComment,
    getCommentsByTicketId,
    updateComment,
    deleteComment,
};