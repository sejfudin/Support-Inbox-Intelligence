const { computeMonthStats, averageAttendanceRate } = require('./attendanceStats');

// A fully elapsed month keeps these deterministic: once the month is in the past
// the `min(monthEnd, today)` clamp always lands on the month end, so the working-
// day denominator can't drift as the suite is re-run later.
// June 2026: Mon 1 – Tue 30, 22 working days.
const PAST_MONTH = '2026-06';
const PAST_MONTH_WORKING_DAYS = 22;

const records = (...dates) => dates.map((date) => ({ date }));

describe('computeMonthStats', () => {
  it('counts present days against the month’s working days', () => {
    const stats = computeMonthStats(records('2026-06-01', '2026-06-02'), PAST_MONTH, null);

    expect(stats).toEqual({
      presentDays: 2,
      workingDays: PAST_MONTH_WORKING_DAYS,
      attendanceRate: Math.round((2 / PAST_MONTH_WORKING_DAYS) * 100),
    });
  });

  it('reads a full month as 100%', () => {
    const allDays = [];
    for (let day = 1; day <= 30; day += 1) {
      const key = `2026-06-${String(day).padStart(2, '0')}`;
      const weekday = new Date(Date.UTC(2026, 5, day, 12)).getUTCDay();
      if (weekday !== 0 && weekday !== 6) allDays.push(key);
    }

    expect(computeMonthStats(records(...allDays), PAST_MONTH, null)).toEqual({
      presentDays: PAST_MONTH_WORKING_DAYS,
      workingDays: PAST_MONTH_WORKING_DAYS,
      attendanceRate: 100,
    });
  });

  it('prorates from the start date so a mid-month joiner is not penalised', () => {
    // Joined Mon 2026-06-22; that leaves Mon–Tue 22–30 = 7 working days.
    const stats = computeMonthStats(
      records('2026-06-22', '2026-06-23'),
      PAST_MONTH,
      new Date('2026-06-22T00:00:00Z')
    );

    expect(stats.workingDays).toBe(7);
    expect(stats.presentDays).toBe(2);
    expect(stats.attendanceRate).toBe(29);
  });

  it('ignores records outside the requested month', () => {
    const stats = computeMonthStats(
      records('2026-05-29', '2026-06-01', '2026-07-01'),
      PAST_MONTH,
      null
    );

    expect(stats.presentDays).toBe(1);
  });

  it('returns a zero rate rather than dividing by zero when nothing is in range', () => {
    // Start date after the month ends → no working days to measure against.
    const stats = computeMonthStats([], PAST_MONTH, new Date('2026-09-01T00:00:00Z'));

    expect(stats).toEqual({ presentDays: 0, workingDays: 0, attendanceRate: 0 });
  });
});

describe('averageAttendanceRate', () => {
  it('averages and rounds', () => {
    expect(averageAttendanceRate([100, 90, 81])).toBe(90);
  });

  it('reads an empty set as 0 instead of NaN', () => {
    expect(averageAttendanceRate([])).toBe(0);
  });
});
