export const normalizeTicket = (ticket = {}) => {
  const id = ticket._id ?? ticket.id ?? ticket.ticketId ?? ticket.uuid;
  const title = ticket.subject ?? ticket.title ?? ticket.name ?? "Untitled";
  const description = ticket.description ?? "";
  const status = ticket.status ?? "open";
  const assignedTo = Array.isArray(ticket.assignedTo)
    ? ticket.assignedTo
    : ticket.assignedTo
      ? [ticket.assignedTo]
      : [];
  const dueDate = ticket.dueDate ?? ticket.due ?? null;
  const totalTimeSpent = ticket.totalTimeSpent ?? 0;
  const inProgressAt = ticket.inProgressAt ?? null;
  const doneAt = ticket.doneAt ?? null;

  return {
    id,
    title,
    description,
    status,
    assignedTo,
    dueDate,
    totalTimeSpent,
    inProgressAt,
    doneAt,
    raw: ticket,
  };
};
