const Comment = require('../models/Comment');
const Ticket = require('../models/Ticket');

const createComment = async ({ content, ticket, authorId, userWorkspaceId, role }) => {
  if (!content) throw new Error('Comment content is required');

  const foundTicket = await Ticket.findById(ticket);
  if (!foundTicket) throw new Error('Ticket not found');

  if (foundTicket.isArchived) {
    throw new Error('Unauthorized: Cannot comment on an archived ticket');
  }

  if(role!='admin'){
    if (foundTicket.workspace.toString() !== userWorkspaceId.toString()) {
      throw new Error('Unauthorized: You do not belong to this workspace');
    }
  }

  let comment = await Comment.create({
    content,
    ticket,
    author: authorId,
  });

  return await comment.populate('author', 'fullname email');

};

const getCommentsByTicketId = async (ticketId, userWorkspaceId, role) => {

  const foundTicket = await Ticket.findById(ticketId);
  
  if(role!='admin'){
    if (!foundTicket || foundTicket.workspace.toString() !== userWorkspaceId.toString()) {
        throw new Error('Unauthorized to view comments for this ticket');
    }
  }
  
  return await Comment.find({ ticket: ticketId })
    .populate('author', 'fullname email')
    .sort({ createdAt: 1 });
};

const updateComment = async (commentId, content, userId) => {
  const comment = await Comment.findById(commentId).populate('ticket');
  if (!comment) throw new Error('Comment not found');

  if (comment.ticket.isArchived) {
    throw new Error('Unauthorized: Cannot edit comments on an archived ticket');
  }

  if (comment.author.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only edit your own comments');
  }

  if (comment.author.toString() !== userId.toString()) {
    throw new Error('Unauthorized to update this comment');
  }

  comment.content = content;
  comment.isEdited = true;
  await comment.save();

  return comment.populate('author', 'fullname email');
};

const deleteComment = async (commentId, userId, role) => {
  const comment = await Comment.findById(commentId).populate('ticket');
  if (!comment) throw new Error('Comment not found');

  if (comment.ticket.isArchived) {
    throw new Error('Unauthorized: Cannot delete comments on an archived ticket');
  }

  const isAuthor = comment.author.toString() === userId.toString();
  const isAdmin = role === 'admin';

  if (!isAuthor && !isAdmin) {
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