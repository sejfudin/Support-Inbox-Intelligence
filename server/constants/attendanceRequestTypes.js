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

/**
 * The two numbers above are **defaults**, not the law: an admin sets them per type
 * from their profile, and what is stored arrives here as a `limits` override —
 * `{ [type]: { maxDaysPerRequest, yearlyBudget } }` — loaded by
 * `services/attendanceSettingsService.js` and passed down from the service layer.
 *
 * Everything else on a row stays fixed in code, because none of it is a quantity
 * an admin can weigh up: `label` is copy, `backdateWorkingDays` encodes why sick
 * days may look backwards, and `attended` decides arithmetic that the whole
 * attendance module is built on.
 *
 * The readers take the override as an argument rather than reaching for it. This
 * file has no database access on purpose — `helpers/attendanceRequestRules.js`
 * depends on it and is deliberately Mongoose-free so the rules unit-test without
 * a Mongo — and an override is per-call anyway.
 */

/** Rails an admin cannot configure outside of. Sanity, not policy. */
const LIMIT_BOUNDS = Object.freeze({
  // Six working weeks in a single request. Past this, it is a leave of absence
  // and not something the admin queue should be deciding as one row.
  maxDaysPerRequest: Object.freeze({ min: 1, max: 30 }),
  // Roughly every working day in a year. A budget is a bound, so zero is not
  // offered: a type nobody may use should be removed, not silently zeroed.
  yearlyBudget: Object.freeze({ min: 1, max: 260 }),
});

/** The shipped numbers, as the shape an override takes. */
const DEFAULT_LIMITS = Object.freeze(
  Object.fromEntries(
    REQUEST_TYPES.map((type) => [
      type,
      Object.freeze({
        maxDaysPerRequest: TYPE_RULES[type].maxDaysPerRequest,
        yearlyBudget: TYPE_RULES[type].yearlyBudget,
      }),
    ])
  )
);

/**
 * Whether this type is bounded by a yearly allowance at all.
 *
 * Read off the table rather than listed, so "remote and sick are unbudgeted" is
 * stated in exactly one place — their `yearlyBudget: null` — and an admin cannot
 * introduce a budget where the design says there is none. Both are deliberate:
 * exam week must not become a queue of refusals, and an intern who is ill past a
 * cap cannot be refused their illness.
 */
const isBudgetedType = (type) => rulesFor(type).yearlyBudget !== null;

// A stored override is only honoured if it is a positive whole number. Anything
// else — null, a string, a legacy key, a hand-edited document — falls through to
// the default rather than propagating as a limit nobody chose.
const configuredValue = (value) => (Number.isInteger(value) && value > 0 ? value : null);

/** The most days one request of this type may cover, under `limits` if given. */
const maxDaysFor = (type, limits) =>
  configuredValue(limits?.[type]?.maxDaysPerRequest) ?? rulesFor(type).maxDaysPerRequest;

/** Days per calendar year for this type under `limits`, or null if it is unbudgeted. */
const yearlyBudgetFor = (type, limits) => {
  if (!isBudgetedType(type)) return null;
  return configuredValue(limits?.[type]?.yearlyBudget) ?? rulesFor(type).yearlyBudget;
};

/** Whether a day of this type counts as worked (remote) or is exempt (the rest). */
const isAttendedType = (type) => rulesFor(type).attended;

module.exports = {
  REMOTE,
  VACATION,
  RELIGIOUS,
  SICK,
  REQUEST_TYPES,
  TYPE_RULES,
  LIMIT_BOUNDS,
  DEFAULT_LIMITS,
  isRequestType,
  isBudgetedType,
  rulesFor,
  maxDaysFor,
  yearlyBudgetFor,
  isAttendedType,
};
