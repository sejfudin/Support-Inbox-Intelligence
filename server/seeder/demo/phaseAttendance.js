/**
 * Phase 4 — attendance history.
 *
 * Absence is never stored: a missing row IS the absence (see models/Attendance).
 * So generating attendance means deciding which working days DO get a row.
 *
 * Rules this has to respect or the roster renders wrong:
 *  - Only working days. `countWorkingDays` is the denominator in
 *    `computeMonthStats`, so a weekend row pushes a rate above 100%.
 *  - Days are office-local 'YYYY-MM-DD' strings, from helpers/attendanceTime.
 *  - `intern` is an InternProfile id, not a User id.
 *  - `checkedInAt` should land inside the 07:00–11:00 office window, since that
 *    is the only time a real check-in could have happened.
 *  - Only `active`/`ready` profiles appear on the admin roster (ROSTER_STATUSES
 *    in attendanceService), so terminal-status interns get no rows at all.
 */

const Attendance = require('../../models/Attendance');
const { officeMonthKey, monthBounds, countWorkingDays } = require('../../helpers/attendanceTime');
const { stableId } = require('./clock');

// Oldest history we generate. Interns who started more recently are clamped to
// their start date, which is also what computeMonthStats does when it prorates.
const HISTORY_WORKDAYS = 40;

const run = async (ctx) => {
  const { data, clock } = ctx;
  const docs = [];
  const summary = [];

  // The roster reports per calendar month, not over all history, so the run
  // summary mirrors computeMonthStats (attendanceService) — otherwise the
  // terminal prints one rate and the screen shows another.
  const { start: monthStart, end: monthEnd } = monthBounds(officeMonthKey(clock.now));
  const monthRangeEnd = clock.todayKey < monthEnd ? clock.todayKey : monthEnd;

  for (const spec of data.interns) {
    if (!spec.attendance) continue; // terminal statuses: off the roster entirely

    const profile = ctx.profiles.get(spec.key);
    const user = ctx.users.get(spec.key);
    const hubId = user.hub || null;

    const startKey = clock.workdaysAgo(Math.min(spec.startWorkdaysAgo, HISTORY_WORKDAYS));
    const days = clock.workdayRange(startKey, clock.anchorKey);

    const cancelledKey =
      spec.attendance.cancelledWorkdaysAgo != null
        ? clock.workdaysAgo(spec.attendance.cancelledWorkdaysAgo)
        : null;

    // Present days that fall inside the current calendar month — the number the
    // roster actually renders.
    let presentThisMonth = 0;
    const countIfThisMonth = (dateKey) => {
      if (dateKey >= monthStart && dateKey <= monthRangeEnd) presentThisMonth += 1;
    };

    days.forEach((dateKey, index) => {
      const isToday = dateKey === clock.anchorKey;

      // Today is driven explicitly by `attendance.today` so the current column
      // on the roster is a deliberate mix: some in, some not yet, one cancelled.
      if (isToday) {
        if (spec.attendance.today === 'none' && !ctx.options.checkinToday) return;
        const status = spec.attendance.today === 'cancelled' ? 'cancelled' : 'present';
        docs.push({
          _id: stableId(`attendance:${spec.key}:${dateKey}`),
          intern: profile._id,
          date: dateKey,
          status,
          checkedInAt: clock.at(dateKey, 8, spec.attendance.checkInMinute ?? 30),
          hub: hubId,
          checkInIp: null,
        });
        if (status === 'present') countIfThisMonth(dateKey);
        return;
      }

      if (dateKey === cancelledKey) {
        docs.push({
          _id: stableId(`attendance:${spec.key}:${dateKey}`),
          intern: profile._id,
          date: dateKey,
          status: 'cancelled',
          checkedInAt: clock.at(dateKey, 8, 40),
          hub: hubId,
          checkInIp: null,
        });
        return;
      }

      // The absence pattern: every Nth working day has no row. Deterministic,
      // so the rate on screen is the same on every re-seed.
      if (index % spec.attendance.absentEvery === 0) return;

      docs.push({
        _id: stableId(`attendance:${spec.key}:${dateKey}`),
        intern: profile._id,
        date: dateKey,
        // Stagger arrival times across 07:35–10:2x so the roster's check-in
        // column doesn't look machine-generated.
        checkedInAt: clock.at(dateKey, 7 + ((index * 7) % 4), 35 + ((index * 13) % 25)),
        status: 'present',
        hub: hubId,
        checkInIp: null,
      });
      countIfThisMonth(dateKey);
    });

    // Working-day denominator for the month, prorated from the intern's start
    // date exactly as computeMonthStats does.
    const profileStartKey = clock.workdaysAgo(spec.startWorkdaysAgo);
    const rangeStart = profileStartKey > monthStart ? profileStartKey : monthStart;
    const monthWorkingDays =
      rangeStart <= monthRangeEnd ? countWorkingDays(rangeStart, monthRangeEnd) : 0;

    summary.push({
      name: user.fullname,
      persona: spec.attendance.persona,
      present: presentThisMonth,
      workingDays: monthWorkingDays,
      rate: monthWorkingDays ? Math.round((presentThisMonth / monthWorkingDays) * 100) : 0,
      today: spec.attendance.today,
    });
  }

  await Attendance.insertMany(docs);
  ctx.counts.attendance = docs.length;
  ctx.attendanceSummary = summary;
};

module.exports = { run, HISTORY_WORKDAYS };
