export const isMongoId = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export function getTicketIdFromNotification(notification) {
  if (!notification) return null;
  const t = notification.ticket;
  if (typeof t === "string") return t;
  return t?._id ?? t ?? null;
}
