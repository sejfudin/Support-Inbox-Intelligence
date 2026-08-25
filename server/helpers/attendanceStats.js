const {
  officeDateKey,
  monthBounds,
  countWorkingDays,
  previousDayKey,
  nextDayKey,
  keyToDate,
  isWeekendKey,
} = require('./attendanceTime');

const EMPTY_SET = new Set();

/**
 * Split raw attendance rows into the buckets every caller needs.
 *
 * Lives here, next to `computeMonthStats`, because **both** services that compute a
 * rate have to agree on which rows are which. `attendanceService` used to own this
 * privately while `adminDashboardService` did its own thing (every non-cancelled
 * row counted as present) — harmless while `remote` was the only extra status,
 * and silently wrong the moment a vacation row appeared. One partition, two
 * callers, no drift.
 *
 * The three buckets answer three different questions:
 *
 * - `records` — days that count toward the numerator: a real check-in or an
 *   approved remote day. Working from home is work.
 * - `exemptDates` — approved vacation, religious holiday or sick leave. These leave
 *   the denominator (see `computeMonthStats`); they are neither attended nor missed.
 * - `cancelledDates` — the intern unchecked the day. Reads as absent, and the day
 *   is free to be claimed again.
 *
 * `requestedDays` is a flat `{ 'YYYY-MM-DD': status }` map of every row an approval
 * wrote, sent to the client so it can colour the day by what it actually is. One
 * lookup per cell, rather than four Sets to build and search.
 */
const splitRows = (rows) => {
  const Attendance = require('../models/Attendance');
  const { CANCELLED, PRESENT, REMOTE } = Attendance;
  const exemptStatuses = new Set(Attendance.EXEMPT_STATUSES);

  const records = [];
  const cancelledDates = [];
  const exemptDates = [];
  const requestedDays = {};
  let lastCheckIn = null;

  for (const row of rows) {
    if (row.status === CANCELLED) {
      cancelledDates.push(row.date);
      continue;
    }

    if (row.status !== PRESENT) requestedDays[row.date] = row.status;

    if (exemptStatuses.has(row.status)) {
      exemptDates.push(row.date);
      continue;
    }

    records.push({ date: row.date, checkedInAt: row.checkedInAt });

    if (row.status === REMOTE) {
      // Deliberately not a candidate for `lastCheckIn`: nobody checked in. The
      // timestamp on a remote row is when an admin approved it, and surfacing that
      // under "Last check-in" would misreport an approval as an arrival.
      continue;
    }
    if (!lastCheckIn || row.checkedInAt > lastCheckIn) lastCheckIn = row.checkedInAt;
  }

  return { records, cancelledDates, exemptDates, requestedDays, lastCheckIn };
};

/**
 * Attendance stats for a single calendar month. Working days (Mon–Fri) are
 * counted within the month, clamped to `[max(monthStart, startDate), min(monthEnd,
 * today, lastOwedDay)]` — so a mid-month joiner isn't penalised for days before
 * they started, the current month only counts elapsed days, and an intern placed
 * on a real project stops accruing days from their `placedAt`. Always computed
 * from raw records, never stored, so it can't go stale.
 * `records` may be the full history or already month-scoped — the date clamp
 * makes both correct.
 *
 * `placedAt` is the intern's first day on a real project, from which they are no
 * longer obliged to record attendance. It is **inclusive-from**: `placedAt` itself
 * is already exempt, so the last owed day is the day before it.
 *
 * `attendanceRate` is **null when nothing was owed** (`workingDays === 0`) — a
 * placed intern, or a month entirely before the start date. This is deliberately
 * not `0`: "no obligation" and "attended nothing" are different facts, and
 * conflating them renders a fabricated 0% that reads exactly like a real one.
 * Callers must handle null (render `—`, and exclude it from averages).
 *
 * `exemptDates` is this **one intern's** approved vacation, religious-holiday and
 * sick days (`splitRows` above produces it). They leave the denominator exactly the
 * way a cohort-wide `nonWorkingDay` does, and for the same reason: a day nobody
 * owed is not an absence. The difference is only who it applies to — which is why
 * it arrives per call rather than being loaded once.
 *
 * A day off could have been counted three ways and only this one is honest.
 * Counting it as attended would read a month of holiday as 100%; counting it as
 * absent would punish leave an admin approved. Leaving the sum on both sides reads
 * as what it is: nothing owed, nothing missed.
 *
 * `placementExemptions` is the same idea applied backwards in time: placement
 * stretches the intern has already RETURNED from (`InternProfile.placementExemptions`).
 * `placedAt` covers the stretch they are on now, but it is a single open boundary and
 * says nothing about one that ended — so without this a returning intern is billed
 * for every day they were legitimately on a project, since absence is the absence of
 * a record. Expanded here rather than merged into `exemptDates` by each caller: this
 * is the only function that may act on it, so it is also the only one that should
 * have to know how.
 *
 * Lives here rather than in attendanceService because both the admin roster and
 * the admin dashboard derive the same numbers from their own record sets.
 */
const computeMonthStats = (
  records,
  monthKey,
  startDate,
  placedAt = null,
  nonWorkingDays = EMPTY_SET,
  exemptDates = EMPTY_SET,
  placementExemptions = []
) => {
  const { start, end } = monthBounds(monthKey);
  const todayKey = officeDateKey();
  const startKey = startDate ? officeDateKey(startDate) : null;
  const rangeStart = startKey && startKey > start ? startKey : start;

  let rangeEnd = todayKey < end ? todayKey : end;
  const lastOwedKey = placedAt ? previousDayKey(officeDateKey(placedAt)) : null;
  if (lastOwedKey && lastOwedKey < rangeEnd) rangeEnd = lastOwedKey;

  // Cohort-wide and personal exclusions do the same job, so the denominator sees
  // one set. Built per call because the personal half differs per intern.
  const exemptKeys = exemptDates instanceof Set ? exemptDates : new Set(exemptDates);
  const placementKeys = placementExemptKeys(placementExemptions);
  const excluded =
    exemptKeys.size || placementKeys.size
      ? new Set([...nonWorkingDays, ...exemptKeys, ...placementKeys])
      : nonWorkingDays;

  const workingDays = rangeStart <= rangeEnd ? countWorkingDays(rangeStart, rangeEnd, excluded) : 0;
  // A check-in on an excluded day is dropped too, not just from the denominator:
  // counting it while its day is excluded could push a rate above 100%.
  const presentDays = records.filter(
    (r) => r.date >= rangeStart && r.date <= rangeEnd && !excluded.has(r.date)
  ).length;
  const attendanceRate = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : null;
  return { presentDays, workingDays, attendanceRate };
};

/**
 * Mean of a set of per-intern attendance rates, rounded. Nulls (interns who owed
 * nothing that month) are skipped rather than counted as zero, which would drag
 * the average down for people who were never absent. Empty set reads as 0 rather
 * than NaN so the dashboard can render it unconditionally.
 */
const averageAttendanceRate = (rates) => {
  const measured = rates.filter((rate) => typeof rate === 'number');
  if (!measured.length) return 0;
  return Math.round(measured.reduce((sum, rate) => sum + rate, 0) / measured.length);
};

/**
 * Whether the intern is exempt from recording attendance on `dateKey` because they
 * are already on a real project. Inclusive-from `placedAt`.
 *
 * Reads the OPEN stretch only — the placement the intern is on right now. Stretches
 * they have already come back from live in `placementExemptions` and are deliberately
 * not consulted here: this answers "may they check in / must they be reminded", and
 * a finished placement has no bearing on that. Only the historical arithmetic
 * (`computeMonthStats`, via `placementExemptKeys`) cares about those.
 */
const isExemptOn = (placedAt, dateKey) => Boolean(placedAt) && dateKey >= officeDateKey(placedAt);

/**
 * Expand `InternProfile.placementExemptions` into the 'YYYY-MM-DD' keys they cover,
 * ready to be merged into the exempt days handed to `computeMonthStats`.
 *
 * Each stint is half-open `[from, to)`: `from` is the day the intern left for the
 * project and is already exempt (inclusive, matching `placedAt`), `to` is the day
 * they rejoined and owed attendance again, so it is NOT exempt. A stint whose
 * bounds touch or cross expands to nothing — that is the intern who was placed on
 * paper and brought back before the start date ever arrived, and no day of theirs
 * was ever excused.
 *
 * Weekends are left out. They change no arithmetic either way — `countWorkingDays`
 * never counted one — but this Set is also sent to the client, where a weekend inside
 * a placement would render as "On project" rather than as a weekend, reading as a day
 * the intern worked. The client's `placementExemptKeySet` applies the same rule.
 */
const placementExemptKeys = (placementExemptions = []) => {
  const keys = new Set();
  for (const stint of placementExemptions) {
    if (!stint?.from || !stint?.to) continue;
    const fromKey = officeDateKey(stint.from);
    const toKey = officeDateKey(stint.to);
    for (let key = fromKey; key < toKey; key = nextDayKey(key)) {
      if (!isWeekendKey(key)) keys.add(key);
    }
  }
  return keys;
};

/**
 * The two fields a profile needs written to close its open placement stretch,
 * because the intern is rejoining the programme today: `placedAt` cleared, and
 * `[placedAt, today)` appended to `placementExemptions`. Pure — reads `profile`,
 * returns the next values, writes nothing. The caller assigns both fields and
 * saves; every caller is already mid-mutation and saves once anyway, e.g.
 * `Object.assign(profile, closePlacementExemption(profile))`.
 *
 * Call this on EVERY path back onto the programme. Clearing `placedAt` on its own
 * is the bug this exists to prevent: it hands the intern retroactive absence for
 * the whole stretch they were legitimately away.
 *
 * Records nothing when there is no stretch to record — no `placedAt`, or a
 * `placedAt` that has not arrived yet (placed on paper, never actually left). Both
 * are a plain clear, and both are idempotent, so applying the result twice is safe.
 *
 * Deliberately NOT used when an admin sets `placedAt` to null by hand: that path
 * means "this exemption was a mistake", and a correction should leave no trace of
 * the thing it corrected. This one means "they came back", which did happen.
 */
const closePlacementExemption = (profile, now = new Date()) => {
  const from = profile.placedAt;
  if (!from) return { placedAt: null, placementExemptions: profile.placementExemptions || [] };

  const todayKey = officeDateKey(now);
  const placementExemptions =
    officeDateKey(from) < todayKey
      ? [...(profile.placementExemptions || []), { from, to: keyToDate(todayKey) }]
      : profile.placementExemptions || [];
  return { placedAt: null, placementExemptions };
};

/**
 * The day a placement stops the intern owing attendance, or null if it doesn't
 * stop it yet. Feeds `InternProfile.placedAt`.
 *
 * That day is the placement's `startDate` — their first day on the project — and
 * nothing else. Not the Resulted date, which is when the decision was recorded,
 * and not `result.decidedAt`, which is when someone got around to clicking it.
 * An intern placed today who starts in ten days is on the programme for those ten
 * days and owes attendance for every one of them.
 *
 * A placement with no start date yet returns null: no exemption. Substituting the
 * decision date here would silently forgive real absence for the whole gap, and
 * the gap is exactly the case this field exists for.
 */
const placementExemptionDate = (result) =>
  result?.outcome === 'placed' && result.startDate ? new Date(result.startDate) : null;

/**
 * Every non-working day as a Set of 'YYYY-MM-DD' keys, ready for the helpers above.
 * The collection holds a handful of rows per year, so it is read whole rather than
 * range-scoped — cheaper than threading month bounds through every call site.
 */
const loadNonWorkingDays = async () => {
  const NonWorkingDay = require('../models/NonWorkingDay');
  const rows = await NonWorkingDay.find({}).select('date label kind').lean();
  return {
    keys: new Set(rows.map((r) => r.date)),
    // Sent to the client so the calendar can mark the day, say why, and colour a
    // remote week apart from a holiday. `kind` is presentation only — every kind
    // is dropped from the denominator identically, via `keys` above.
    list: rows.map((r) => ({ date: r.date, label: r.label, kind: r.kind || 'holiday' })),
  };
};

/**
 * Every religious observance, as a plain list for the client to mark on the
 * calendar. Read whole for the same reason `loadNonWorkingDays` is — a few dozen
 * rows across several years is cheaper than threading date bounds through every
 * call site.
 *
 * Carries no attendance meaning whatsoever: see `models/Observance.js`. It is
 * returned alongside `nonWorkingDays` and must never be merged into it.
 */
const loadObservances = async () => {
  const Observance = require('../models/Observance');
  const rows = await Observance.find({})
    .select('date label tradition provisional')
    .sort({ date: 1 })
    .lean();
  return rows.map((r) => ({
    date: r.date,
    label: r.label,
    tradition: r.tradition || 'other',
    provisional: Boolean(r.provisional),
  }));
};

module.exports = {
  splitRows,
  computeMonthStats,
  loadObservances,
  averageAttendanceRate,
  isExemptOn,
  placementExemptKeys,
  closePlacementExemption,
  placementExemptionDate,
  loadNonWorkingDays,
};
