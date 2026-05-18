import { normalizeStoryPoints } from './storyPoints';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/** API may return status as a slug string or populated TicketStatus object. */
export const extractStatusSlug = (statusRef) => {
  if (statusRef == null || statusRef === '') return '';
  if (typeof statusRef === 'object') {
    return String(statusRef.slug ?? '').trim();
  }
  const str = String(statusRef).trim();
  if (OBJECT_ID_RE.test(str)) return '';
  return str;
};

export const extractStatusMeta = (statusRef) =>
  statusRef && typeof statusRef === 'object' ? statusRef : null;

export const extractStatusId = (statusRef) => {
  if (statusRef == null || statusRef === '') return '';
  if (typeof statusRef === 'object' && statusRef._id != null) {
    return String(statusRef._id);
  }
  const str = String(statusRef).trim();
  if (OBJECT_ID_RE.test(str)) return str;
  return '';
};

/** Human-readable status label for display/export (resolves ObjectId and slug via workspace statuses). */
export const resolveStatusLabel = (statusRef, statuses = []) => {
  if (statusRef == null || statusRef === '') return '';

  if (typeof statusRef === 'object') {
    const label = String(statusRef.label ?? '').trim();
    if (label) return label;
    const slug = String(statusRef.slug ?? '').trim();
    if (slug) {
      const bySlug = statuses.find((s) => s.slug === slug);
      return bySlug?.label || slug;
    }
    if (statusRef._id != null) {
      const byId = statuses.find((s) => String(s._id) === String(statusRef._id));
      return byId?.label || '';
    }
    return '';
  }

  const str = String(statusRef).trim();
  if (!str) return '';

  if (OBJECT_ID_RE.test(str)) {
    const byId = statuses.find((s) => String(s._id) === str);
    return byId?.label || '';
  }

  const bySlug = statuses.find((s) => s.slug === str);
  return bySlug?.label || str;
};

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
