/**
 * Pure rules for a ticket draft — the unsent New-ticket form an account keeps in
 * a workspace, so that closing the modal (or the tab) does not throw away what
 * was typed.
 *
 * A draft is scratch state, not a ticket. Nothing in it is required, and a value
 * the form could not have produced is **normalized away rather than rejected**:
 * autosave runs on every keystroke, and an autosave that answers 400 stops
 * saving silently, which is the one failure a draft must not have. The real
 * validation happens once, when the draft is submitted as a ticket through
 * `POST /api/tickets`.
 *
 * Workspace scoping is deliberately NOT here — deciding whether a status,
 * category, assignee or blocking ticket belongs to the workspace needs the
 * database, and lives in `services/ticketDraftService.js`.
 */
const mongoose = require('mongoose');

const { BLOCKER_NOTE_MAX_LENGTH } = require('./ticketBlocker');

// Mirrors the `Ticket` schema's own enum and cap. Duplicated as data rather
// than imported from the model, so this file stays free of Mongoose and can be
// unit-tested without one.
const DRAFT_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const DEFAULT_DRAFT_PRIORITY = 'medium';
const DRAFT_SUBJECT_MAX_LENGTH = 100;
const DRAFT_MAX_ASSIGNEES = 50;

// The form's date input, which is a local calendar day (`YYYY-MM-DD`) and not an
// instant. Stored as the string the input holds: turning it into a `Date` here
// and back on the way out is what shifts a due date by a day across a timezone,
// and the draft's job is to hand the form back exactly what was in it.
const DRAFT_DUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toOptionalObjectId = (value) => {
  if (!value) return null;
  const id = typeof value === 'object' ? (value._id ?? value.id) : value;
  const str = id ? String(id).trim() : '';
  return str && mongoose.Types.ObjectId.isValid(str) ? str : null;
};

const normalizeDraftSubject = (value) =>
  String(value ?? '')
    .trim()
    .slice(0, DRAFT_SUBJECT_MAX_LENGTH);

const normalizeDraftPriority = (value) => {
  const priority = String(value ?? '')
    .trim()
    .toLowerCase();
  return DRAFT_PRIORITIES.includes(priority) ? priority : DEFAULT_DRAFT_PRIORITY;
};

const normalizeDraftStoryPoints = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const points = Number(value);
  return Number.isInteger(points) && points >= 1 && points <= 5 ? points : null;
};

const normalizeDraftDueDate = (value) => {
  const dueDate = String(value ?? '').trim();
  return DRAFT_DUE_DATE_RE.test(dueDate) ? dueDate : '';
};

const normalizeDraftAssignees = (value) => {
  const list = Array.isArray(value) ? value : [];
  const ids = list.map(toOptionalObjectId).filter(Boolean);
  return [...new Set(ids)].slice(0, DRAFT_MAX_ASSIGNEES);
};

const normalizeDraftBlocker = (value) => ({
  ticket: toOptionalObjectId(value?.ticket ?? value?.ticketId),
  note: String(value?.note ?? '')
    .trim()
    .slice(0, BLOCKER_NOTE_MAX_LENGTH),
});

/**
 * Whether a rich-text description holds anything a person typed. The editor
 * emits `<p></p>` for an empty document, so a bare length check would keep every
 * abandoned modal alive as a draft.
 */
const hasDescriptionText = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim().length > 0;

/**
 * The whole form, normalized for storage. `description` arrives already
 * sanitized — the sanitizer is the service's job (see the file comment).
 */
const normalizeDraftInput = (input = {}) => ({
  subject: normalizeDraftSubject(input.subject),
  description: String(input.description ?? ''),
  status: toOptionalObjectId(input.status ?? input.statusId),
  priority: normalizeDraftPriority(input.priority),
  storyPoints: normalizeDraftStoryPoints(input.storyPoints),
  assignedTo: normalizeDraftAssignees(input.assignedTo),
  dueDate: normalizeDraftDueDate(input.dueDate),
  category: toOptionalObjectId(input.category),
  blockedBy: normalizeDraftBlocker(input.blockedBy),
});

/**
 * "Nothing was typed" — the test that decides whether a save stores a draft or
 * deletes the one that is there. `status` and `priority` are excluded on
 * purpose: the modal opens with both already filled in (the column that was
 * clicked, and `medium`), so counting them would make merely *opening* the modal
 * leave a draft behind for the next visit to restore.
 */
const isDraftEmpty = (draft = {}) =>
  !normalizeDraftSubject(draft.subject) &&
  !hasDescriptionText(draft.description) &&
  normalizeDraftStoryPoints(draft.storyPoints) === null &&
  normalizeDraftAssignees(draft.assignedTo).length === 0 &&
  !normalizeDraftDueDate(draft.dueDate) &&
  !toOptionalObjectId(draft.category) &&
  !toOptionalObjectId(draft.blockedBy?.ticket) &&
  !String(draft.blockedBy?.note ?? '').trim();

module.exports = {
  DEFAULT_DRAFT_PRIORITY,
  DRAFT_MAX_ASSIGNEES,
  DRAFT_PRIORITIES,
  DRAFT_SUBJECT_MAX_LENGTH,
  hasDescriptionText,
  isDraftEmpty,
  normalizeDraftAssignees,
  normalizeDraftBlocker,
  normalizeDraftDueDate,
  normalizeDraftInput,
  normalizeDraftPriority,
  normalizeDraftStoryPoints,
  normalizeDraftSubject,
  toOptionalObjectId,
};
