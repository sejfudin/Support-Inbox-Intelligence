const { officeDateKey, monthBounds, countWorkingDays } = require('./attendanceTime');

/**
 * Attendance stats for a single calendar month. Working days (Mon–Fri) are
 * counted within the month, clamped to `[max(monthStart, startDate), min(monthEnd,
 * today)]` — so a mid-month joiner isn't penalised for days before they started,
 * and the current month only counts elapsed days. Always computed from raw
 * records, never stored, so it can't go stale.
 * `records` may be the full history or already month-scoped — the date clamp
 * makes both correct.
 *
 * Lives here rather than in attendanceService because both the admin roster and
 * the admin dashboard derive the same numbers from their own record sets.
 */
const computeMonthStats = (records, monthKey, startDate) => {
  const { start, end } = monthBounds(monthKey);
  const todayKey = officeDateKey();
  const startKey = startDate ? officeDateKey(startDate) : null;
  const rangeStart = startKey && startKey > start ? startKey : start;
  const rangeEnd = todayKey < end ? todayKey : end;
  const workingDays = rangeStart <= rangeEnd ? countWorkingDays(rangeStart, rangeEnd) : 0;
  const presentDays = records.filter((r) => r.date >= rangeStart && r.date <= rangeEnd).length;
  const attendanceRate = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
  return { presentDays, workingDays, attendanceRate };
};

/**
 * Mean of a set of per-intern attendance rates, rounded. Empty set reads as 0
 * rather than NaN so the dashboard can render it unconditionally.
 */
const averageAttendanceRate = (rates) => {
  if (!rates.length) return 0;
  return Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length);
};

module.exports = { computeMonthStats, averageAttendanceRate };
