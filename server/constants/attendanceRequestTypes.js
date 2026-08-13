/**
 * The four things an intern can ask an admin for, and everything that differs
 * between them.
 *
 * This table is the single source for the per-type rules. It lives here rather
 * than in the model because `helpers/attendanceRequestRules.js` needs it too, and
 * that file is deliberately Mongoose-free so its rules can be unit-tested without
 * a database. (pt.1 kept the ceiling in both the model and the rules helper as two
 * separate literal `3`s — this is the fix for that.)
 *
 * Adding a fifth type should mean adding a row here and a colour on the client,
 * and nothing else.
 */

const REMOTE = 'remote';
const VACATION = 'vacation';
const RELIGIOUS = 'religious';
const SICK = 'sick';

const REQUEST_TYPES = [REMOTE, VACATION, RELIGIOUS, SICK];

/**
 * @typedef {object} RequestTypeRule
 * @property {string} label            - what the intern and admin see
 * @property {number} maxDaysPerRequest - ceiling on ONE request; not a budget
 * @property {number|null} yearlyBudget - days per calendar year, or null for no limit
 * @property {number} backdateWorkingDays - how many working days before today may be requested
 * @property {boolean} attended        - does the day count as worked?
 */
const TYPE_RULES = Object.freeze({
  // The pt.1 type. Three bounds a request, not an intern: wanting a fourth day
  // means another request, and nothing limits how many. An intern with exams all
  // week files two rather than being refused.
  [REMOTE]: Object.freeze({
    label: 'Remote work',
    maxDaysPerRequest: 3,
    yearlyBudget: null,
    backdateWorkingDays: 0,
    attended: true,
  }),
  // Five days is both the per-request ceiling and the whole year's allowance, so
  // one request can spend the lot. That is intended — a week off is the ordinary
  // case, and making them file five separate requests for it would be theatre.
  [VACATION]: Object.freeze({
    label: 'Vacation',
    maxDaysPerRequest: 5,
    yearlyBudget: 5,
    backdateWorkingDays: 0,
    attended: false,
  }),
  // Same shape as vacation with a smaller allowance. Three a year covers one
  // multi-day observance, or three single days across different faiths' calendars.
  [RELIGIOUS]: Object.freeze({
    label: 'Religious holiday',
    maxDaysPerRequest: 3,
    yearlyBudget: 3,
    backdateWorkingDays: 0,
    attended: false,
  }),
  // One day per request and no yearly budget, because illness is not something an
  // intern spends down — the bound is on the request so each day gets its own
  // decision, and a three-day flu is three requests an admin sees separately.
  //
  // The only type that may be backdated. You file a sick day *after* being ill:
  // future-only would make the feature useful only to an intern who predicts
  // illness before the 11:00 check-in window closes. Two working days back covers
  // "ill Monday, back Wednesday" without opening the whole history to relabelling.
  [SICK]: Object.freeze({
    label: 'Sick day',
    maxDaysPerRequest: 1,
    yearlyBudget: null,
    backdateWorkingDays: 2,
    attended: false,
  }),
});

const isRequestType = (type) => Object.prototype.hasOwnProperty.call(TYPE_RULES, type);

/**
 * The rules for `type`, or the remote rules if it is not a known type.
 *
 * Falling back rather than throwing keeps the schema validator and the read paths
 * total — a row written before a type existed still renders. The rules helper
 * refuses an unknown type up front, so nothing reaches the fallback by accident.
 */
const rulesFor = (type) => TYPE_RULES[type] || TYPE_RULES[REMOTE];

/** The most days one request of this type may cover. */
const maxDaysFor = (type) => rulesFor(type).maxDaysPerRequest;

/** Days per calendar year for this type, or null if it is unbudgeted. */
const yearlyBudgetFor = (type) => rulesFor(type).yearlyBudget;

/** Whether a day of this type counts as worked (remote) or is exempt (the rest). */
const isAttendedType = (type) => rulesFor(type).attended;

/** The largest ceiling across all types — what a client can safely pre-allocate. */
const MAX_DAYS_ANY_TYPE = Math.max(...REQUEST_TYPES.map(maxDaysFor));

module.exports = {
  REMOTE,
  VACATION,
  RELIGIOUS,
  SICK,
  REQUEST_TYPES,
  TYPE_RULES,
  MAX_DAYS_ANY_TYPE,
  isRequestType,
  rulesFor,
  maxDaysFor,
  yearlyBudgetFor,
  isAttendedType,
};
