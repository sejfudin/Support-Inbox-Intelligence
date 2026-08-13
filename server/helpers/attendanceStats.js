const {
  officeDateKey,
  monthBounds,
  countWorkingDays,
  previousDayKey,
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
 * Lives here rather than in attendanceService because both the admin roster and
 * the admin dashboard derive the same numbers from their own record sets.
 */
const computeMonthStats = (
  records,
  monthKey,
  startDate,
  placedAt = null,
  nonWorkingDays = EMPTY_SET,
  exemptDates = EMPTY_SET
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
  const excluded = exemptKeys.size ? new Set([...nonWorkingDays, ...exemptKeys]) : nonWorkingDays;

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
 */
const isExemptOn = (placedAt, dateKey) => Boolean(placedAt) && dateKey >= officeDateKey(placedAt);

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
  placementExemptionDate,
  loadNonWorkingDays,
};
