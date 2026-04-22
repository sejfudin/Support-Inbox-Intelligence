const Notification = require("../models/Notification");
const { sendToUser } = require("../socket/socketServer");

const MAX_LIST = 50;

const toRecipientId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value._id) return toRecipientId(value._id);
    if (value.id) return String(value.id);
  }
  return null;
};

const listForUser = async (userId, { limit = 30 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), MAX_LIST);
  const [items, unreadCount] = await Promise.all([
    Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean(),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);
  return { items, unreadCount };
};

const markRead = async (notificationId, userId) => {
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { read: true } },
    { new: true },
  ).lean();
  if (!doc) {
    const err = new Error("Notification not found");
    err.statusCode = 404;
    throw err;
  }
  return doc;
};

const markAllRead = async (userId) => {
  await Notification.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true } },
  );
  return { ok: true };
};

const notifyNewTicketComment = async ({
  ticket,
  authorId,
  commentPreview,
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

  if (recipientIds.size === 0) return;

  const taskLabel = ticket.taskNumber ? `#${ticket.taskNumber}` : "ticket";
  const title = `New comment on ${taskLabel}`;
  const body =
    commentPreview && commentPreview.length > 200
      ? `${commentPreview.slice(0, 197)}...`
      : commentPreview || "";

  const workspaceId = ticket.workspace;

  for (const rid of recipientIds) {
    const n = await Notification.create({
      recipient: rid,
      read: false,
      type: "ticket_comment",
      title,
      body,
      ticket: ticket._id,
      workspace: workspaceId,
    });

    sendToUser(rid, "new_notification", {
      notification: n.toObject(),
      unreadDelta: 1,
    });
  }
};

const notifyTicketAssigned = async ({
  ticket,
  assignedUserIds = [],
}) => {
  if (!ticket || !ticket._id) return;

  const recipientIds = [
    ...new Set((assignedUserIds || []).map(toRecipientId).filter(Boolean)),
  ];
  if (recipientIds.length === 0) return;

  const taskLabel = ticket.taskNumber ? `#${ticket.taskNumber}` : "ticket";
  const title = `Assigned to ${taskLabel}`;
  const body = ticket.subject ? `Task: ${ticket.subject}` : "";
  const workspaceId = ticket.workspace;

  for (const rid of recipientIds) {
    const n = await Notification.create({
      recipient: rid,
      read: false,
      type: "ticket_assigned",
      title,
      body,
      ticket: ticket._id,
      workspace: workspaceId,
    });

    sendToUser(rid, "new_notification", {
      notification: n.toObject(),
      unreadDelta: 1,
    });
  }
};

module.exports = {
  listForUser,
  markRead,
  markAllRead,
  notifyNewTicketComment,
  notifyTicketAssigned,
};
