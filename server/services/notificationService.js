const Notification = require('../models/Notification');
const { sendToUser } = require('../socket/socketServer');
const { invalidationScopes } = require('../socket/invalidationScopes');

const MAX_LIST = 50;

const toRecipientId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      return value.toHexString();
    }

    if (value._id && value._id !== value) return toRecipientId(value._id);
    if (value.id) return String(value.id);

    if (typeof value.toString === 'function') {
      const normalized = value.toString();
      if (normalized && normalized !== '[object Object]') {
        return normalized;
      }
    }
  }
  return null;
};

// `type` narrows the feed to one notification type (e.g. the mentor dashboard's
// "notes for me" card, which only wants `mentor_note_from_staff`). Optional —
// omitted, this returns the caller's normal mixed feed. `unreadCount` stays
// unfiltered either way: it backs the bell badge, a global count, not a
// per-type one.
const listForUser = async (userId, { limit = 30, type } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), MAX_LIST);
  const filter = { recipient: userId, ...(type ? { type } : {}) };
  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(safeLimit).lean(),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);
  return { items, unreadCount };
};

const markRead = async (notificationId, userId) => {
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { read: true } },
    { returnDocument: 'after' }
  ).lean();
  if (!doc) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
  return doc;
};

const markAllRead = async (userId) => {
  const unreadNotifications = await Notification.find(
    { recipient: userId, read: false },
    { _id: 1 }
  ).lean();

  if (unreadNotifications.length === 0) {
    return { ok: true, notificationIds: [] };
  }

  const notificationIds = unreadNotifications.map((item) => String(item._id));

  await Notification.updateMany(
    { _id: { $in: notificationIds }, recipient: userId, read: false },
    { $set: { read: true } }
  );

  return { ok: true, notificationIds };
};

const notifyNewTicketComment = async ({
  ticket,
  authorId,
  commentPreview,
  excludeRecipientIds = [],
}) => {
  if (!ticket || !ticket._id) return;

  const recipientIds = new Set();
  const creatorId = toRecipientId(ticket.creator);
  if (creatorId) recipientIds.add(creatorId);
  (ticket.assignedTo || []).forEach((id) => {
    const normalized = toRecipientId(id);
    if (normalized) recipientIds.add(normalized);
  });
  recipientIds.delete(String(authorId));
  const excluded = new Set((excludeRecipientIds || []).map((id) => String(id)));
  excluded.forEach((id) => recipientIds.delete(id));

  if (recipientIds.size === 0) return;

  const taskLabel = ticket.taskNumber ? `#${ticket.taskNumber}` : 'ticket';
  const title = `New comment on ${taskLabel}`;
  const body =
    commentPreview && commentPreview.length > 200
      ? `${commentPreview.slice(0, 197)}...`
      : commentPreview || '';

  const workspaceId = ticket.workspace;

  for (const rid of recipientIds) {
    const n = await Notification.create({
      recipient: rid,
      read: false,
      type: 'ticket_comment',
      title,
      body,
      ticket: ticket._id,
      workspace: workspaceId,
    });

    sendToUser(rid, 'new_notification', {
      notification: n.toObject(),
      recipientId: String(rid),
      scopes: [invalidationScopes.user(rid), invalidationScopes.ticket(ticket._id)],
      unreadDelta: 1,
    });
  }
};

const notifyTicketAssigned = async ({ ticket, assignedUserIds = [], actorUserId }) => {
  if (!ticket || !ticket._id) return;

  const actorId = toRecipientId(actorUserId);

  const recipientIds = [
    ...new Set(
      (assignedUserIds || [])
        .map(toRecipientId)
        .filter((recipientId) => Boolean(recipientId) && recipientId !== actorId)
    ),
  ];
  if (recipientIds.length === 0) return;

  const taskLabel = ticket.taskNumber ? `#${ticket.taskNumber}` : 'ticket';
  const title = `Assigned to ${taskLabel}`;
  const body = ticket.subject ? `Task: ${ticket.subject}` : '';
  const workspaceId = ticket.workspace;

  for (const rid of recipientIds) {
    const n = await Notification.create({
      recipient: rid,
      read: false,
      type: 'ticket_assigned',
      title,
      body,
      ticket: ticket._id,
      workspace: workspaceId,
    });

    sendToUser(rid, 'new_notification', {
      notification: n.toObject(),
      recipientId: String(rid),
      scopes: [
        invalidationScopes.user(rid),
        invalidationScopes.ticket(ticket._id),
        invalidationScopes.workspace(workspaceId),
      ],
      unreadDelta: 1,
    });
  }
};

const notifyTicketMention = async ({
  ticket,
  authorId,
  recipientIds = [],
  commentPreview = '',
  commentId = null,
}) => {
  if (!ticket || !ticket._id) return;

  const actorId = toRecipientId(authorId);
  const uniqueRecipients = [
    ...new Set((recipientIds || []).map(toRecipientId).filter(Boolean)),
  ].filter((rid) => rid !== actorId);

  if (uniqueRecipients.length === 0) return;

  const taskLabel = ticket.taskNumber ? `#${ticket.taskNumber}` : 'ticket';
  const title = `You were mentioned on ${taskLabel}`;
  const body =
    commentPreview && commentPreview.length > 200
      ? `${commentPreview.slice(0, 197)}...`
      : commentPreview || '';

  for (const rid of uniqueRecipients) {
    const n = await Notification.create({
      recipient: rid,
      read: false,
      type: 'ticket_mention',
      title,
      body,
      ticket: ticket._id,
      workspace: ticket.workspace,
      comment: commentId,
    });

    sendToUser(rid, 'new_notification', {
      notification: n.toObject(),
      recipientId: String(rid),
      scopes: [invalidationScopes.user(rid), invalidationScopes.ticket(ticket._id)],
      unreadDelta: 1,
    });
  }
};

// Recipient: the reviewer. Fires on a first request AND every repeat request
// (see ticket-review-requests spec) — a silent second round means the mentor
// never looks, so this is deliberately called on replace-on-re-request too.
const notifyTicketReviewRequested = async ({ ticket, reviewerId, actorUserId }) => {
  if (!ticket || !ticket._id) return;

  const rid = toRecipientId(reviewerId);
  const actorId = toRecipientId(actorUserId);
  if (!rid || rid === actorId) return;

  const taskLabel = ticket.taskNumber ? `#${ticket.taskNumber}` : 'ticket';
  const title = `Review requested on ${taskLabel}`;
  const body = ticket.subject ? `Task: ${ticket.subject}` : '';
  const workspaceId = ticket.workspace;

  const n = await Notification.create({
    recipient: rid,
    read: false,
    type: 'ticket_review_requested',
    title,
    body,
    ticket: ticket._id,
    workspace: workspaceId,
  });

  sendToUser(rid, 'new_notification', {
    notification: n.toObject(),
    recipientId: String(rid),
    scopes: [
      invalidationScopes.user(rid),
      invalidationScopes.ticket(ticket._id),
      invalidationScopes.workspace(workspaceId),
    ],
    unreadDelta: 1,
  });
};

// Recipient: the requesting intern. The verdict itself carries no words, so
// the body must point at the pull request — that link is the only place the
// reviewer's actual comments live.
const notifyTicketReviewCompleted = async ({ ticket, internId, state, prUrl }) => {
  if (!ticket || !ticket._id) return;

  const rid = toRecipientId(internId);
  if (!rid) return;

  const taskLabel = ticket.taskNumber ? `#${ticket.taskNumber}` : 'ticket';
  const verdictLabel = state === 'approved' ? 'Approved' : 'Changes requested';
  const title = `${verdictLabel}: ${taskLabel}`;
  const body = prUrl ? `Pull request: ${prUrl}` : '';
  const workspaceId = ticket.workspace;

  const n = await Notification.create({
    recipient: rid,
    read: false,
    type: 'ticket_review_completed',
    title,
    body,
    ticket: ticket._id,
    workspace: workspaceId,
  });

  sendToUser(rid, 'new_notification', {
    notification: n.toObject(),
    recipientId: String(rid),
    scopes: [
      invalidationScopes.user(rid),
      invalidationScopes.ticket(ticket._id),
      invalidationScopes.workspace(workspaceId),
    ],
    unreadDelta: 1,
  });
};

module.exports = {
  listForUser,
  markRead,
  markAllRead,
  notifyNewTicketComment,
  notifyTicketAssigned,
  notifyTicketMention,
  notifyTicketReviewRequested,
  notifyTicketReviewCompleted,
};
