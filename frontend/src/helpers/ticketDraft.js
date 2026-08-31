/**
 * The New-ticket form <-> the stored draft.
 *
 * A draft is the modal's own form state, kept on the server so that closing the
 * modal — or the tab, or the laptop — does not throw away what was typed. These
 * two conversions are the whole contract with `server/models/TicketDraft.js`:
 * the form's shape is `hooks/useTicketForm.js`, and everything that leaves this
 * file is JSON the API can take.
 *
 * The emptiness rule is stated on both sides on purpose (the server's copy is
 * `helpers/ticketDraftRules.js`), the same way the blocker rules are. The server
 * is authoritative — it is what deletes an emptied draft; this copy exists so the
 * client does not send a save per keystroke for a modal nobody typed in.
 */
import { emptyBlocker, blockerTicketId, toBlockerPayload } from '@/helpers/ticketBlocker';

const assigneeList = (assignedTo) => (Array.isArray(assignedTo) ? assignedTo : []);

const hasText = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim().length > 0;

/** Form state as the API takes it — ids, not the documents the form renders from. */
export const toDraftPayload = (form = {}) => ({
  subject: String(form.subject ?? ''),
  description: String(form.description ?? ''),
  status: form.status || null,
  priority: form.priority || 'medium',
  storyPoints: form.storyPoints ?? null,
  assignedTo: assigneeList(form.assignedTo),
  dueDate: String(form.dueDate ?? ''),
  category: form.category || null,
  blockedBy: toBlockerPayload(form.blockedBy),
});

/**
 * A stored draft as the form holds it.
 *
 * `blockedBy.ticket` stays the populated document the API sent, because that is
 * what `BlockedByField` renders as "Ticket 12" — the payload above turns it back
 * into an id on the way out.
 *
 * `fallbackStatus` covers a draft whose status has since been deleted from the
 * workspace (the server drops the reference): the modal opens on the column it
 * was opened from rather than on no status at all.
 */
export const draftToForm = (draft, fallbackStatus = '') => ({
  subject: draft?.subject ?? '',
  description: draft?.description ?? '',
  status: draft?.status ? String(draft.status) : fallbackStatus,
  priority: draft?.priority || 'medium',
  storyPoints: draft?.storyPoints ?? null,
  assignedTo: assigneeList(draft?.assignedTo).map(String),
  dueDate: draft?.dueDate ?? '',
  category: draft?.category ? String(draft.category) : null,
  blockedBy: draft?.blockedBy
    ? { ticket: draft.blockedBy.ticket || null, note: String(draft.blockedBy.note || '') }
    : emptyBlocker(),
});

/**
 * "Nothing was typed." Status and priority are excluded deliberately: the modal
 * arrives with both already set (the column that was clicked, and `medium`), so
 * counting them would make opening and closing the modal leave a draft behind.
 */
export const isDraftFormEmpty = (form = {}) =>
  !String(form.subject ?? '').trim() &&
  !hasText(form.description) &&
  (form.storyPoints ?? null) === null &&
  assigneeList(form.assignedTo).length === 0 &&
  !String(form.dueDate ?? '').trim() &&
  !form.category &&
  !blockerTicketId(form.blockedBy?.ticket) &&
  !String(form.blockedBy?.note ?? '').trim();

/** Cheap equality over the wire shape — what keeps autosave from re-sending the same draft. */
export const draftPayloadsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The "saved at" stamp in the modal header — a clock time, not a relative
 * phrase. "2 minutes ago" would need a ticking timer to stay true, and the only
 * question this line answers is "did the last thing I typed make it in?".
 */
export const formatDraftSavedAt = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};
