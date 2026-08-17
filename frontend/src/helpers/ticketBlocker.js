/**
 * Client-side mirror of `server/helpers/ticketBlocker.js` — the rules for the
 * "why can't this move?" record a ticket carries while it is Blocked.
 *
 * The two sides are separate packages (CommonJS vs ESM), so the slug and the note
 * cap are stated twice on purpose, the same way the dashboards' `WORKLOAD_SLUGS`
 * are. The server is authoritative: everything here is for showing the field and
 * keeping the Save button honest.
 *
 * **Keyed on the status slug, never the label.** A workspace can rename "Blocked"
 * and the rename deliberately keeps the slug, so the field follows the rename.
 */

export const BLOCKED_STATUS_SLUG = 'blocked';

export const BLOCKER_NOTE_MAX_LENGTH = 500;

export const isBlockedStatusSlug = (slug) =>
  String(slug || '')
    .trim()
    .toLowerCase() === BLOCKED_STATUS_SLUG;

/** Status pickers hold ids; the slug lives on the option, so resolve through it. */
export const isBlockedStatusId = (statusOptions = [], statusId) =>
  isBlockedStatusSlug(statusOptions.find((o) => o.value === String(statusId))?.slug);

export const emptyBlocker = () => ({ ticket: null, note: '' });

/** Blocker as the form holds it — `ticket` kept as the populated doc so it renders. */
export const blockerFromTicket = (ticket) => ({
  ticket: ticket?.blockedBy?.ticket || null,
  note: String(ticket?.blockedBy?.note || ''),
});

export const blockerTicketId = (ticket) => {
  if (!ticket) return null;
  if (typeof ticket === 'object') return ticket._id ? String(ticket._id) : null;
  return String(ticket) || null;
};

export const isBlockerEmpty = (blocker) =>
  !blockerTicketId(blocker?.ticket) && !String(blocker?.note || '').trim();

export const blockersEqual = (a, b) =>
  blockerTicketId(a?.ticket) === blockerTicketId(b?.ticket) &&
  String(a?.note || '').trim() === String(b?.note || '').trim();

/** Wire shape — the API takes an id, not the populated document we render from. */
export const toBlockerPayload = (blocker) => ({
  ticket: blockerTicketId(blocker?.ticket),
  note: String(blocker?.note || '').trim(),
});

export const ticketRefLabel = (ticket) =>
  ticket?.taskNumber ? `Ticket ${ticket.taskNumber}` : 'Linked ticket';

/**
 * List/board chip text, or `null` when there is nothing worth a chip.
 *
 * A number is the whole point of the chip — it is what makes the reference
 * recognisable at a glance and clickable. A blocker that is only a note has
 * nothing to show here (the Blocked status badge already says it is blocked), and
 * a link the list endpoint didn't populate would render as "Blocked by #undefined".
 */
export const blockedByChipLabel = (blockerTicket) =>
  blockerTicket?.taskNumber ? `Blocked by #${blockerTicket.taskNumber}` : null;
