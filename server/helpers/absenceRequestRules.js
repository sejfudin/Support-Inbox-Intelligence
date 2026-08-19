const { isWeekendKey, officeDateKey, previousWorkingDayKey } = require('./attendanceTime');
const {
  REMOTE,
  SICK,
  isRequestType,
  rulesFor,
  maxDaysFor,
  yearlyBudgetFor,
} = require('../constants/absenceRequestTypes');

/**
 * The rules governing absence requests — remote work, vacation, religious
 * holidays and sick days — as pure functions over plain 'YYYY-MM-DD' keys.
 *
 * Kept out of the service on purpose: this repo has no integration or E2E suite,
 * so logic that only exists inside a Mongo-touching service is logic that is never
 * tested. Everything here is decided from arguments alone and is covered by
 * `absenceRequestRules.test.js`.
 *
 * What differs per type is not branched on here — it is read from
 * `constants/absenceRequestTypes.js`, so a new type is a row in that table
 * rather than an `if` in this file.
 *
 * The two numbers an admin can set — the per-request ceiling and the yearly
 * allowance — arrive as an optional `limits` argument, shaped
 * `{ [type]: { maxDaysPerRequest, yearlyBudget } }` and loaded by
 * `services/absenceSettingsService.js`. Passed in rather than fetched: this
 * file must not learn how to reach a database, or the rules stop being testable
 * without one. Omit it and every function falls back to the shipped defaults,
 * which is what keeps the existing tests honest — they assert the behaviour of
 * the table, not of whatever a developer's database happens to hold.
 */

const EMPTY_SET = new Set();

/** The calendar year a day belongs to, as a string. Budgets are charged per year. */
const yearOf = (dateKey) => String(dateKey).slice(0, 4);

/**
 * Whether a request still holds a claim on the days it names.
 *
 * Pending always does — the admin has not answered yet. Approved does only for
 * days still ahead; an elapsed day is history and cannot be re-requested anyway.
 * Rejected, cancelled and revoked never do, which is what lets a refused day be
 * asked for again.
 */
const isOutstanding = (request, todayKey = officeDateKey()) => {
  if (!request) return false;
  if (request.status === 'pending') return true;
  if (request.status !== 'approved') return false;
  return (request.dates || []).some((date) => date >= todayKey);
};

/**
 * The days live requests still hold, as a Map of day → { status, type }.
 *
 * Deliberately across all types: an intern with a pending vacation day on Friday
 * cannot also ask to work remotely that Friday, and the message they get should
 * name which of their own requests is in the way.
 */
const claimedDays = (requests = [], todayKey = officeDateKey()) => {
  const claimed = new Map();
  for (const request of requests) {
    if (!isOutstanding(request, todayKey)) continue;
    for (const date of request.dates || []) {
      // An approved claim outranks a pending one in the message it produces, and
      // a day can only be approved once, so first-approved wins.
      if (!claimed.has(date) || request.status === 'approved') {
        claimed.set(date, { status: request.status, type: request.type || REMOTE });
      }
    }
  }
  return claimed;
};

/**
 * How many days of `type` this intern has already committed, per calendar year.
 *
 * Counts pending as well as approved. If pending did not consume budget, five
 * simultaneous five-day vacation requests would each pass the check and an admin
 * could approve all of them into a twenty-five-day holiday. Rejected, cancelled
 * and revoked requests release their days, so a refused week is not spent.
 *
 * A request straddling New Year is split: each day is charged to the year it falls
 * in, so booking 30 Dec – 2 Jan draws two days from each allowance rather than
 * four from whichever year the intern happened to file in.
 *
 * @returns {Map<string, number>} year → days used
 */
const usedDaysByYear = (requests = [], type, todayKey = officeDateKey()) => {
  const used = new Map();
  for (const request of requests) {
    if ((request.type || REMOTE) !== type) continue;
    // An elapsed approved day is still spent — it was taken. `isOutstanding` is
    // about holding a *claim* on a day, which is a different question, so the
    // budget looks at the status directly.
    const spent = request.status === 'pending' || request.status === 'approved';
    if (!spent) continue;
    for (const date of request.dates || []) {
      const year = yearOf(date);
      used.set(year, (used.get(year) || 0) + 1);
    }
  }
  return used;
};

/**
 * What is left of one type's yearly allowance, for the UI to show before the
 * intern picks anything. Null for an unbudgeted type (remote, sick) — the caller
 * renders "no limit" rather than a number.
 *
 * `remaining` clamps at zero, which matters more now that the allowance can be
 * lowered underneath days already taken: an intern who spent four when the budget
 * drops to three is out of days, not owed minus one.
 */
const budgetStateFor = (type, year, requests = [], limits) => {
  const budget = yearlyBudgetFor(type, limits);
  if (budget === null) return null;
  const used = usedDaysByYear(requests, type).get(String(year)) || 0;
  return { budget, used, remaining: Math.max(0, budget - used) };
};

/**
 * The earliest day this type may be requested for.
 *
 * Everything except sick is today-or-later: a retroactive request would let an
 * intern convert a recorded absence into an approved day after the fact, which is
 * the one thing this feature must not become. Sick is the deliberate exception —
 * see the note on its row in the type table.
 */
const earliestRequestableKey = (type, todayKey = officeDateKey(), nonWorkingKeys = EMPTY_SET) => {
  const { backdateWorkingDays } = rulesFor(type);
  if (!backdateWorkingDays) return todayKey;
  return previousWorkingDayKey(todayKey, backdateWorkingDays, nonWorkingKeys);
};

/**
 * Why a day cannot be requested, or null if it can.
 *
 * Returns the reason string rather than throwing so the caller decides the status
 * code, and so the whole table of refusals is testable without a try/catch per
 * case. Order matters only for which message the intern sees first; every check is
 * independent.
 *
 * @param {string} dateKey - the requested day, 'YYYY-MM-DD'
 * @param {object} ctx
 * @param {string} [ctx.type] - which of the four; defaults to remote
 * @param {string} ctx.todayKey - today in office time
 * @param {Set<string>} [ctx.nonWorkingKeys] - cohort-wide non-working days
 * @param {string|null} [ctx.startKey] - the intern's first day in the programme
 * @param {string|null} [ctx.placedAtKey] - first day on a real project, inclusive-from
 * @param {Set<string>} [ctx.takenKeys] - days that already have an attendance row
 */
const requestDayRefusal = (
  dateKey,
  {
    type = REMOTE,
    todayKey = officeDateKey(),
    nonWorkingKeys = EMPTY_SET,
    startKey = null,
    placedAtKey = null,
    takenKeys = EMPTY_SET,
  } = {}
) => {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return 'Pick a valid date.';
  }

  const { label, backdateWorkingDays } = rulesFor(type);
  const earliest = earliestRequestableKey(type, todayKey, nonWorkingKeys);
  if (dateKey < earliest) {
    return backdateWorkingDays
      ? `A ${label.toLowerCase()} can only be requested for today or one of the last ${backdateWorkingDays} working days.`
      : `${label} can only be requested for today or a future day.`;
  }
  // Sick is the only type that may look backwards, and even it may not look
  // forwards past today: booking illness in advance is not a thing.
  if (type === SICK && dateKey > todayKey) {
    return 'A sick day can only be requested for a day that has already started.';
  }

  if (isWeekendKey(dateKey)) {
    return `${label} can only be requested for a working day.`;
  }
  if (nonWorkingKeys.has(dateKey)) {
    return 'That day is already a non-working day for everyone.';
  }
  if (startKey && dateKey < startKey) {
    return 'That day is before you joined the programme.';
  }
  // Inclusive-from, matching `isExemptOn`: `placedAt` itself is already exempt.
  if (placedAtKey && dateKey >= placedAtKey) {
    return 'You are on a project, so you no longer record attendance.';
  }
  if (takenKeys.has(dateKey)) {
    return 'Your attendance for that day is already recorded.';
  }
  return null;
};

/**
 * Normalise a submitted day list: drop blanks, de-duplicate, sort. Returns a new
 * array, so a caller can compare it against what was sent.
 *
 * De-duplication rather than refusal is on purpose — "Monday, Monday, Tuesday" is
 * a slip in the picker, not an attempt at anything, and asking for two days while
 * being told you asked for three would be baffling.
 */
const normaliseDates = (dates) =>
  Array.from(new Set((Array.isArray(dates) ? dates : []).filter(Boolean))).sort();

/**
 * Why the yearly allowance refuses this set of days, or null if it covers them.
 *
 * Checked per year rather than per request, so a New Year request is refused only
 * for the side of the boundary that is actually short.
 */
const budgetRefusal = (type, days, existingRequests = [], limits) => {
  const budget = yearlyBudgetFor(type, limits);
  if (budget === null) return null;

  const { label } = rulesFor(type);
  const used = usedDaysByYear(existingRequests, type);

  const wantedByYear = new Map();
  for (const day of days) {
    const year = yearOf(day);
    wantedByYear.set(year, (wantedByYear.get(year) || 0) + 1);
  }

  for (const [year, wanted] of wantedByYear) {
    const already = used.get(year) || 0;
    if (already + wanted <= budget) continue;
    const remaining = Math.max(0, budget - already);
    if (remaining === 0) {
      return `You have used all ${budget} of your ${label.toLowerCase()} days for ${year}.`;
    }
    return `That would take you over your ${budget} ${label.toLowerCase()} days for ${year} — you have ${remaining} left.`;
  }

  return null;
};

/**
 * Why a request cannot be created, or null if it can.
 *
 * Applies, in order: the type itself, the per-type size bound, the per-day rules
 * for every day in it, the one rule that needs the intern's other requests (a day
 * may be claimed by only one live request), and finally the yearly allowance.
 *
 * Budget comes last on purpose. "You have two vacation days left" is only useful
 * once the days themselves are legal — telling an intern they are over budget for
 * a set that included a Saturday would send them to fix the wrong thing.
 *
 * A request is all-or-nothing. One bad day refuses the whole submission rather than
 * being silently dropped, because the intern chose those days together and quietly
 * booking two of the three would be a different request than the one they made.
 *
 * @param {string[]} dates - the requested days; pass them already normalised
 * @param {object} ctx - everything `requestDayRefusal` takes, plus:
 * @param {Array<{dates:string[],status:string,type:string}>} [ctx.existingRequests] -
 *   the intern's requests. Spent ones may be passed too — they are ignored for the
 *   day-claim check and released from the budget — so callers need not pre-filter.
 * @param {object} [ctx.limits] - the admin-set limits; defaults if omitted.
 */
const createRequestRefusal = (dates, ctx = {}) => {
  const { type = REMOTE, limits } = ctx;
  if (!isRequestType(type)) return 'Pick what kind of day you are requesting.';

  const days = normaliseDates(dates);
  const { label } = rulesFor(type);
  const max = maxDaysFor(type, limits);

  if (days.length === 0) return 'Pick at least one day.';
  if (days.length > max) {
    return max === 1
      ? `A ${label.toLowerCase()} request covers a single day. Submit another request for the next one.`
      : `A ${label.toLowerCase()} request can cover at most ${max} days. Submit another request for the rest.`;
  }

  for (const day of days) {
    const refusal = requestDayRefusal(day, ctx);
    if (refusal) return refusal;
  }

  const { existingRequests = [], todayKey = officeDateKey() } = ctx;
  const claimed = claimedDays(existingRequests, todayKey);

  for (const day of days) {
    const claim = claimed.get(day);
    if (!claim) continue;
    const claimLabel = rulesFor(claim.type).label.toLowerCase();
    return claim.status === 'approved'
      ? `You already have an approved ${claimLabel} day on one of those dates.`
      : `You already have a ${claimLabel} request for one of those dates waiting on a decision.`;
  }

  return budgetRefusal(type, days, existingRequests, limits);
};

module.exports = {
  yearOf,
  isOutstanding,
  claimedDays,
  usedDaysByYear,
  budgetStateFor,
  earliestRequestableKey,
  normaliseDates,
  requestDayRefusal,
  budgetRefusal,
  createRequestRefusal,
};
