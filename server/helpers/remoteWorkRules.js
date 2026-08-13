const { isWeekendKey, officeDateKey } = require('./attendanceTime');

/**
 * The rules governing remote-work requests, as pure functions over plain
 * 'YYYY-MM-DD' keys.
 *
 * Kept out of the service on purpose: this repo has no integration or E2E suite,
 * so logic that only exists inside a Mongo-touching service is logic that is
 * never tested. Everything here is decided from arguments alone and is covered by
 * `remoteWorkRules.test.js`.
 */

const EMPTY_SET = new Set();

/**
 * The most days one request may cover. Re-exported from the model so callers have
 * a single source for it.
 *
 * **This bounds a request, not an intern.** There is no limit on how many
 * requests may be open at once, and that is not an oversight: an intern with
 * exams all week files two requests (3 days, then 2) and gets their week. A cap
 * on the total would turn that ordinary case into a queue of refusals.
 */
const MAX_DAYS_PER_REQUEST = 3;

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

/** The days a live request still holds, as a Map of day → that request's status. */
const claimedDays = (requests = [], todayKey = officeDateKey()) => {
  const claimed = new Map();
  for (const request of requests) {
    if (!isOutstanding(request, todayKey)) continue;
    for (const date of request.dates || []) {
      // An approved claim outranks a pending one in the message it produces, and
      // a day can only be approved once, so first-approved wins.
      if (!claimed.has(date) || request.status === 'approved') claimed.set(date, request.status);
    }
  }
  return claimed;
};

/**
 * Why a day cannot be requested, or null if it can.
 *
 * Returns the reason string rather than throwing so the caller decides the status
 * code, and so the whole table of refusals is testable without a try/catch per
 * case. Order matters only for which message the intern sees first; every check
 * is independent.
 *
 * @param {string} dateKey - the requested day, 'YYYY-MM-DD'
 * @param {object} ctx
 * @param {string} ctx.todayKey - today in office time
 * @param {Set<string>} [ctx.nonWorkingKeys] - cohort-wide non-working days
 * @param {string|null} [ctx.startKey] - the intern's first day in the programme
 * @param {string|null} [ctx.placedAtKey] - first day on a real project, inclusive-from
 * @param {Set<string>} [ctx.takenKeys] - days that already have an attendance row
 */
const requestDayRefusal = (
  dateKey,
  {
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
  // Past days are refused outright. Allowing them would let an intern convert a
  // recorded absence into remote work after the fact, which is the one thing this
  // feature must not become. Today is still fair game: the day is not over.
  if (dateKey < todayKey) {
    return 'You can only request remote work for today or a future day.';
  }
  if (isWeekendKey(dateKey)) {
    return 'Remote work can only be requested for a working day.';
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
 * De-duplication rather than refusal is on purpose — "Monday, Monday, Tuesday"
 * is a slip in the picker, not an attempt at anything, and asking for two days
 * while being told you asked for three would be baffling.
 */
const normaliseDates = (dates) =>
  Array.from(new Set((Array.isArray(dates) ? dates : []).filter(Boolean))).sort();

/**
 * Why a request cannot be created, or null if it can.
 *
 * Applies, in order: the size bound on a single request, then the per-day rules
 * for every day in it, then the one rule that needs the intern's other requests —
 * a day may be claimed by only one live request.
 *
 * A request is all-or-nothing. One bad day refuses the whole submission rather
 * than being silently dropped, because the intern chose those days together and
 * quietly booking two of the three would be a different request than the one they
 * made.
 *
 * @param {string[]} dates - the requested days; pass them already normalised
 * @param {object} ctx - everything `requestDayRefusal` takes, plus:
 * @param {Array<{dates:string[],status:string}>} [ctx.existingRequests] - the
 *   intern's live requests. Spent ones may be passed too; they are ignored, so
 *   callers need not pre-filter.
 */
const createRequestRefusal = (dates, ctx = {}) => {
  const days = normaliseDates(dates);

  if (days.length === 0) return 'Pick at least one day.';
  if (days.length > MAX_DAYS_PER_REQUEST) {
    return `A request can cover at most ${MAX_DAYS_PER_REQUEST} days. Submit another request for the rest.`;
  }

  for (const day of days) {
    const refusal = requestDayRefusal(day, ctx);
    if (refusal) return refusal;
  }

  const { existingRequests = [], todayKey = officeDateKey() } = ctx;
  const claimed = claimedDays(existingRequests, todayKey);

  for (const day of days) {
    const status = claimed.get(day);
    if (!status) continue;
    return status === 'approved'
      ? 'You are already approved to work remotely on one of those days.'
      : 'You already have a request for one of those days waiting on a decision.';
  }

  return null;
};

module.exports = {
  MAX_DAYS_PER_REQUEST,
  isOutstanding,
  claimedDays,
  normaliseDates,
  requestDayRefusal,
  createRequestRefusal,
};
