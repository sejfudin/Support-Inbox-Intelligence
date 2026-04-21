const Notification = require("../models/Notification");
const { sendToUser } = require("../socket/socketServer");

const MAX_LIST = 50;

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
  if (ticket.creator) recipientIds.add(String(ticket.creator));
  (ticket.assignedTo || []).forEach((id) => {
    if (id) recipientIds.add(String(id));
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

module.exports = {
  listForUser,
  markRead,
  markAllRead,
  notifyNewTicketComment,
};
