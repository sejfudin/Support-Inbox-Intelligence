const {
  officeDateKey,
  monthBounds,
  countWorkingDays,
  previousDayKey,
} = require('./attendanceTime');

const EMPTY_SET = new Set();

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
 * Lives here rather than in attendanceService because both the admin roster and
 * the admin dashboard derive the same numbers from their own record sets.
 */
const computeMonthStats = (
  records,
  monthKey,
  startDate,
  placedAt = null,
  nonWorkingDays = EMPTY_SET
) => {
  const { start, end } = monthBounds(monthKey);
  const todayKey = officeDateKey();
  const startKey = startDate ? officeDateKey(startDate) : null;
  const rangeStart = startKey && startKey > start ? startKey : start;

  let rangeEnd = todayKey < end ? todayKey : end;
  const lastOwedKey = placedAt ? previousDayKey(officeDateKey(placedAt)) : null;
  if (lastOwedKey && lastOwedKey < rangeEnd) rangeEnd = lastOwedKey;

  const workingDays =
    rangeStart <= rangeEnd ? countWorkingDays(rangeStart, rangeEnd, nonWorkingDays) : 0;
  // A check-in on a non-working day is dropped too, not just from the denominator:
  // counting it while its day is excluded could push a rate above 100%.
  const presentDays = records.filter(
    (r) => r.date >= rangeStart && r.date <= rangeEnd && !nonWorkingDays.has(r.date)
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

module.exports = {
  computeMonthStats,
  averageAttendanceRate,
  isExemptOn,
  placementExemptionDate,
  loadNonWorkingDays,
};
