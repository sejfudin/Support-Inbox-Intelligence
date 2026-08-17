/**
 * Pure rules for a ticket's blocker — the "why can't this move?" record that a
 * ticket carries while it sits in the Blocked status.
 *
 * A blocker has two independent, both-optional halves:
 *   - `ticket` — another ticket in the same workspace this one waits on.
 *   - `note`   — free text for the case where nothing on the board blocks it
 *                (waiting on a client, a credential, an external release).
 *
 * Neither is required: a ticket can be Blocked with the reason not yet known.
 *
 * **Which status counts as "Blocked" is the slug, never the label.** Statuses are
 * per-workspace and renameable, and a rename deliberately keeps the slug (see
 * `statusService.js#updateStatus`) — so a workspace that renames "Blocked" to
 * "Stuck" keeps this field, while one that deletes the status loses it, which is
 * the honest outcome either way.
 */
const { httpError } = require('./httpError');

const BLOCKED_STATUS_SLUG = 'blocked';

const BLOCKER_NOTE_MAX_LENGTH = 500;

const INVALID_BLOCKER_ERROR = 'Blocking ticket is not valid for this workspace';
const SELF_BLOCKER_ERROR = 'A ticket cannot be blocked by itself';
const CIRCULAR_BLOCKER_ERROR = 'That link would create a circular block';
const BLOCKER_NOTE_TOO_LONG_ERROR = `Blocker note cannot be more than ${BLOCKER_NOTE_MAX_LENGTH} characters`;

const EMPTY_BLOCKER = Object.freeze({ ticket: null, note: '' });

const isBlockedStatusSlug = (slug) =>
  String(slug || '')
    .trim()
    .toLowerCase() === BLOCKED_STATUS_SLUG;

/** Ids arrive as strings, ObjectIds or populated docs depending on the caller. */
const extractBlockerTicketId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    const inner = value._id ?? value.id;
    return inner ? String(inner) : null;
  }
  const str = String(value).trim();
  return str || null;
};

const normalizeBlockerNote = (value) => {
  if (value === undefined || value === null) return '';
  const note = String(value).trim();
  if (note.length > BLOCKER_NOTE_MAX_LENGTH) {
    throw httpError(BLOCKER_NOTE_TOO_LONG_ERROR, 400);
  }
  return note;
};

/**
 * Read the client's `blockedBy` payload into `{ ticketId, note }`.
 *
 * Returns `undefined` when the client did not send the field at all — "leave it
 * alone" and "clear it" are different requests, and an edit that only touches the
 * title must not wipe a blocker. `null` / `{}` both mean "clear it".
 */
const parseBlockerInput = (raw) => {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return { ticketId: null, note: '' };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw httpError('Blocker must be an object with a ticket and/or a note', 400);
  }

  return {
    ticketId: extractBlockerTicketId(raw.ticket ?? raw.ticketId),
    note: normalizeBlockerNote(raw.note),
  };
};

const readBlocker = (source) => ({
  ticketId: extractBlockerTicketId(source?.blockedBy?.ticket),
  note: String(source?.blockedBy?.note || '').trim(),
});

const isBlockerEmpty = (blocker) => !blocker?.ticketId && !blocker?.note;

/**
 * What to persist into `blockedBy`, or `undefined` to leave the stored value alone.
 *
 * The one non-obvious rule: **leaving the Blocked status clears the blocker.** A
 * ticket that is In progress while still advertising "blocked by Ticket 12" is
 * simply stating something false, and nobody goes back to tidy it up by hand.
 */
const resolveBlockerUpdate = ({ isBlocked, requested, current }) => {
  if (!isBlocked) {
    return isBlockerEmpty(current) ? undefined : { ...EMPTY_BLOCKER };
  }
  if (requested === undefined) return undefined;
  return { ticket: requested.ticketId || null, note: requested.note || '' };
};

/**
 * History lines for a blocker change — one for the link, one for the note, since
 * they move independently. `labelFor` turns a ticket id into its display label
 * ("Ticket 12"); the service supplies it because only it has the documents.
 */
const describeBlockerChange = ({ previous, next, labelFor = () => 'a ticket' }) => {
  const entries = [];
  if (!next) return entries;

  const before = { ticketId: previous?.ticketId || null, note: previous?.note || '' };
  const after = {
    ticketId: extractBlockerTicketId(next.ticket),
    note: String(next.note || '').trim(),
  };

  if (before.ticketId !== after.ticketId) {
    if (after.ticketId && !before.ticketId) {
      entries.push(`Blocked by ${labelFor(after.ticketId)}`);
    } else if (after.ticketId && before.ticketId) {
      entries.push(
        `Blocking ticket changed from ${labelFor(before.ticketId)} to ${labelFor(after.ticketId)}`
      );
    } else {
      entries.push(`No longer blocked by ${labelFor(before.ticketId)}`);
    }
  }

  if (before.note !== after.note) {
    if (after.note && !before.note) entries.push('Blocker note added');
    else if (after.note) entries.push('Blocker note updated');
    else entries.push('Blocker note removed');
  }

  return entries;
};

module.exports = {
  BLOCKED_STATUS_SLUG,
  BLOCKER_NOTE_MAX_LENGTH,
  BLOCKER_NOTE_TOO_LONG_ERROR,
  CIRCULAR_BLOCKER_ERROR,
  EMPTY_BLOCKER,
  INVALID_BLOCKER_ERROR,
  SELF_BLOCKER_ERROR,
  describeBlockerChange,
  extractBlockerTicketId,
  isBlockedStatusSlug,
  isBlockerEmpty,
  normalizeBlockerNote,
  parseBlockerInput,
  readBlocker,
  resolveBlockerUpdate,
};
