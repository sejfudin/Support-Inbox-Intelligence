const Comment = require('../models/Comment');
const Ticket = require('../models/Ticket');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const { canAccessAnyWorkspace, isActiveWorkspaceMember } = require('../helpers/workspaceAuthz');
const notificationService = require('./notificationService');
const historyService = require('./historyService');
const { buildMentionDirectory, extractMentionHandles } = require('../helpers/commentMention');
const { emitCommentEvent } = require('../socket/events');

const COMMENT_SOCKET_EVENTS = {
  created: 'comment:created',
  updated: 'comment:updated',
  deleted: 'comment:deleted',
};

const emitCommentTicketEvent = ({ eventName, ticketId, workspaceId, commentId }) => {
  emitCommentEvent({ eventName, ticketId, workspaceId, commentId });
};

const createComment = async ({ content, ticket, authorId, role }) => {
  if (!content || !content.trim()) throw new Error('Comment content is required');

  if (content.length > 1000) throw new Error('Comment is too long (max 1000 characters)');

  const foundTicket = await Ticket.findById(ticket);
  if (!foundTicket) throw new Error('Ticket not found');

  if (foundTicket.isArchived) {
    throw new Error('Unauthorized: Cannot comment on an archived ticket');
  }

  // Admins and mentors can comment on tickets in any workspace. Everyone else
  // must be an active member of the ticket's workspace.
  if (!canAccessAnyWorkspace(role)) {
    const workspace = await Workspace.findById(foundTicket.workspace).select('members');

    if (!isActiveWorkspaceMember(workspace, authorId)) {
      throw new Error('Unauthorized: You do not belong to this workspace');
    }
  }

  let comment = await Comment.create({
    content,
    ticket,
    author: authorId,
  });

  historyService.logEvent(ticket, authorId, 'Comment Added');

  const populated = await comment.populate('author', 'fullname email');

  emitCommentTicketEvent({
    eventName: COMMENT_SOCKET_EVENTS.created,
    ticketId: ticket,
    workspaceId: foundTicket.workspace,
    commentId: comment._id,
  });

  let mentionRecipientIds = [];
  try {
    const workspace = await Workspace.findById(foundTicket.workspace).select(
      'members.user members.status'
    );
    const activeMemberIds =
      workspace?.members?.filter((m) => m.status === 'active' && m.user).map((m) => m.user) || [];

    if (activeMemberIds.length > 0) {
      const users = await User.find({ _id: { $in: activeMemberIds } }).select('_id fullname email');
      const { byHandle } = buildMentionDirectory(users);
      const handles = extractMentionHandles(content || '');

      mentionRecipientIds = handles
        .map((h) => byHandle.get(h)?.userId)
        .filter(Boolean)
        .filter((id, idx, arr) => arr.indexOf(id) === idx)
        .filter((id) => String(id) !== String(authorId));
    }
  } catch (err) {
    console.error('[notifications] mention resolution failed:', err.message);
  }

  try {
    await notificationService.notifyNewTicketComment({
      ticket: foundTicket,
      authorId,
      commentPreview: content.trim(),
      excludeRecipientIds: mentionRecipientIds,
    });
  } catch (err) {
    console.error('[notifications] notifyNewTicketComment failed:', err.message);
  }

  try {
    if (mentionRecipientIds.length > 0) {
      await notificationService.notifyTicketMention({
        ticket: foundTicket,
        authorId,
        recipientIds: mentionRecipientIds,
        commentPreview: content.trim(),
        commentId: comment._id,
      });
    }
  } catch (err) {
    console.error('[notifications] notifyTicketMention failed:', err.message);
  }

  return populated;
};

const getCommentsByTicketId = async (ticketId, userId, role) => {
  const foundTicket = await Ticket.findById(ticketId);
  if (!foundTicket) throw new Error('Unauthorized to view comments for this ticket');

  // Admins and mentors can view comments on any workspace's tickets. Everyone
  // else must be an active member of the ticket's workspace.
  if (!canAccessAnyWorkspace(role)) {
    const workspace = await Workspace.findById(foundTicket.workspace).select('members');

    if (!isActiveWorkspaceMember(workspace, userId)) {
      throw new Error('Unauthorized to view comments for this ticket');
    }
  }

  return await Comment.find({
    ticket: ticketId,
    isDeleted: { $ne: true },
  })
    .populate('author', 'fullname email')
    .sort({ createdAt: 1 });
};

const updateComment = async (commentId, content, userId) => {
  const comment = await Comment.findById(commentId).populate('ticket');
  if (!comment || comment.isDeleted) throw new Error('Comment not found');

  if (!content || !content.trim()) throw new Error('Comment content is required');

  if (content.length > 1000) throw new Error('Comment is too long (max 1000 characters)');

  if (comment.ticket.isArchived) {
    throw new Error('Unauthorized: Cannot edit comments on an archived ticket');
  }

  if (comment.author.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only edit your own comments');
  }

  comment.content = content;
  comment.isEdited = true;
  await comment.save();

  historyService.logEvent(comment.ticket._id, userId, 'Comment edited');

  emitCommentTicketEvent({
    eventName: COMMENT_SOCKET_EVENTS.updated,
    ticketId: comment.ticket._id,
    workspaceId: comment.ticket.workspace,
    commentId: comment._id,
  });

  return comment.populate('author', 'fullname email');
};

const deleteComment = async (commentId, userId, role) => {
  const comment = await Comment.findById(commentId).populate('ticket');
  if (!comment || comment.isDeleted) throw new Error('Comment not found');

  if (comment.ticket.isArchived) {
    throw new Error('Unauthorized: Cannot delete comments on an archived ticket');
  }

  const isAuthor = comment.author.toString() === userId.toString();
  const isAdmin = role === 'admin';

  if (!isAuthor && !isAdmin) {
    throw new Error('Unauthorized to delete this comment');
  }

  comment.isDeleted = true;
  await comment.save();

  historyService.logEvent(comment.ticket._id, userId, 'Comment deleted');

  emitCommentTicketEvent({
    eventName: COMMENT_SOCKET_EVENTS.deleted,
    ticketId: comment.ticket._id,
    workspaceId: comment.ticket.workspace,
    commentId: comment._id,
  });

  return { message: 'Comment removed successfully' };
};

module.exports = {
  createComment,
  getCommentsByTicketId,
  updateComment,
  deleteComment,
};
