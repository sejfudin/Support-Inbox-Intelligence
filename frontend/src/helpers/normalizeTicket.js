import { normalizeStoryPoints } from './storyPoints';

/** API may return status as a slug string or populated TicketStatus object. */
export const extractStatusSlug = (statusRef) => {
  if (statusRef == null || statusRef === '') return '';
  if (typeof statusRef === 'object') {
    return String(statusRef.slug ?? '').trim();
  }
  return String(statusRef).trim();
};

export const extractStatusMeta = (statusRef) =>
  statusRef && typeof statusRef === 'object' ? statusRef : null;

export const normalizeTicket = (ticket = {}) => {
  const id = ticket._id ?? ticket.id ?? ticket.ticketId ?? ticket.uuid;
  const title = ticket.subject ?? ticket.title ?? ticket.name ?? 'Untitled';
  const description = ticket.description ?? '';
  const rawStatus = ticket.status ?? '';
  const status = extractStatusSlug(rawStatus);
  const statusMeta = extractStatusMeta(rawStatus);
  const priority = ticket.priority ?? 'medium';
  const storyPoints = normalizeStoryPoints(ticket.storyPoints);
  const assignedTo = Array.isArray(ticket.assignedTo)
    ? ticket.assignedTo
    : ticket.assignedTo
      ? [ticket.assignedTo]
      : [];
  const taskNumber = ticket.taskNumber ?? null;
  const dueDate = ticket.dueDate ?? ticket.due ?? null;
  const totalTimeSpent = ticket.totalTimeSpent ?? 0;
  const inProgressAt = ticket.inProgressAt ?? null;
  const doneAt = ticket.doneAt ?? null;

  return {
    id,
    title,
    description,
    status,
    statusMeta,
    priority,
    storyPoints,
    assignedTo,
    dueDate,
    totalTimeSpent,
    inProgressAt,
    doneAt,
    taskNumber,
    raw: ticket,
  };
};
