const {
  splitRows,
  computeMonthStats,
  averageAttendanceRate,
  placementExemptionDate,
} = require('./attendanceStats');

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

  it('returns a null rate rather than dividing by zero when nothing is in range', () => {
    // Start date after the month ends → no working days to measure against. The
    // rate is null, not 0: nothing was owed, which is not the same as attending
    // nothing, and a fabricated 0% reads exactly like a real one.
    const stats = computeMonthStats([], PAST_MONTH, new Date('2026-09-01T00:00:00Z'));

    expect(stats).toEqual({ presentDays: 0, workingDays: 0, attendanceRate: null });
  });
});

describe('computeMonthStats — placedAt (attendance obligation ends on placement)', () => {
  it('stops counting working days from placedAt, which is itself exempt', () => {
    // Placed Mon 2026-06-08 → owed Mon 1 – Fri 5 only, which is 5 working days.
    // 8 June is NOT counted: placedAt is inclusive-from.
    const stats = computeMonthStats(
      records('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'),
      PAST_MONTH,
      new Date('2026-03-16T00:00:00Z'),
      new Date('2026-06-08T00:00:00Z')
    );

    expect(stats).toEqual({ presentDays: 5, workingDays: 5, attendanceRate: 100 });
  });

  it('reads a month entirely after placedAt as no obligation, not 0%', () => {
    const stats = computeMonthStats(
      [],
      '2026-07',
      new Date('2026-03-16T00:00:00Z'),
      new Date('2026-06-08T00:00:00Z')
    );

    expect(stats).toEqual({ presentDays: 0, workingDays: 0, attendanceRate: null });
  });

  it('ignores records on and after placedAt so a stray check-in cannot exceed 100%', () => {
    // Two owed days (Mon 1, Tue 2 — placed Wed 3) but four records on file.
    const stats = computeMonthStats(
      records('2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'),
      PAST_MONTH,
      null,
      new Date('2026-06-03T00:00:00Z')
    );

    expect(stats).toEqual({ presentDays: 2, workingDays: 2, attendanceRate: 100 });
  });

  it('lands on the same denominator whether placedAt is the weekend or the Monday after', () => {
    // FEP ended Fri 19 June. Sat 20 and Mon 22 must agree, because weekends are
    // already excluded — this is where an off-by-one would hide.
    const args = [records(), PAST_MONTH, null];
    const viaSaturday = computeMonthStats(...args, new Date('2026-06-20T00:00:00Z'));
    const viaMonday = computeMonthStats(...args, new Date('2026-06-22T00:00:00Z'));

    expect(viaSaturday.workingDays).toBe(15);
    expect(viaMonday.workingDays).toBe(15);
  });

  it('behaves exactly as before when placedAt is absent', () => {
    const withoutArg = computeMonthStats(records('2026-06-01'), PAST_MONTH, null);
    const withNull = computeMonthStats(records('2026-06-01'), PAST_MONTH, null, null);

    expect(withoutArg).toEqual(withNull);
    expect(withoutArg.workingDays).toBe(PAST_MONTH_WORKING_DAYS);
  });

  it('applies retroactively: absences after a back-dated placedAt stop counting', () => {
    // The real case: an intern is absent from 1 July onward, then weeks later an
    // admin records that they were placed on Fri 3 July. Only Wed 1 and Thu 2 July
    // were ever owed; everything from 3 July on must drop out, not read as absence.
    const stats = computeMonthStats(
      records('2026-07-01'),
      '2026-07',
      new Date('2026-03-16T00:00:00Z'),
      new Date('2026-07-03T00:00:00Z')
    );

    expect(stats).toEqual({ presentDays: 1, workingDays: 2, attendanceRate: 50 });
  });

  it('reports no obligation for every month after a back-dated placedAt', () => {
    // Same intern, looking at August: the whole month is past their last owed day,
    // so there is nothing to measure — not a month of absences.
    const stats = computeMonthStats(
      [],
      '2026-08',
      new Date('2026-03-16T00:00:00Z'),
      new Date('2026-07-03T00:00:00Z')
    );

    expect(stats).toEqual({ presentDays: 0, workingDays: 0, attendanceRate: null });
  });

  it('prorates start date and placedAt together', () => {
    // Joined Mon 8 June, placed Mon 22 June → owed 8–19 June = 10 working days.
    const stats = computeMonthStats(
      records('2026-06-08', '2026-06-09'),
      PAST_MONTH,
      new Date('2026-06-08T00:00:00Z'),
      new Date('2026-06-22T00:00:00Z')
    );

    expect(stats.workingDays).toBe(10);
    expect(stats.presentDays).toBe(2);
    expect(stats.attendanceRate).toBe(20);
  });
});

describe('computeMonthStats — non-working days (holidays, breaks, remote weeks)', () => {
  // May 2026 is the real case: 21 Mon–Fri days, but 1 May is Labour Day and
  // 27–29 May were a programme break, so only 17 were ever owed. Before this the
  // app counted all 21 and every intern read ~17pt low against the mentor's sheet.
  const MAY = '2026-05';
  const MAY_EXCLUDED = new Set(['2026-05-01', '2026-05-27', '2026-05-28', '2026-05-29']);

  it('drops excluded weekdays from the denominator', () => {
    const plain = computeMonthStats([], MAY, null);
    const withHolidays = computeMonthStats([], MAY, null, null, MAY_EXCLUDED);

    expect(plain.workingDays).toBe(21);
    expect(withHolidays.workingDays).toBe(17);
  });

  it('reproduces the spreadsheet rate once they are excluded', () => {
    // 16 present out of the 17 owed days = 94%, matching the sheet. Counting the
    // full 21 would read 76%.
    const present = [];
    for (let day = 1; day <= 31; day += 1) {
      const key = `2026-05-${String(day).padStart(2, '0')}`;
      const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      if (MAY_EXCLUDED.has(key) || key === '2026-05-04') continue; // one genuine absence
      present.push(key);
    }

    const stats = computeMonthStats(records(...present), MAY, null, null, MAY_EXCLUDED);

    expect(stats).toEqual({ presentDays: 16, workingDays: 17, attendanceRate: 94 });
  });

  it('ignores a check-in recorded on an excluded day, so a rate cannot exceed 100%', () => {
    // Someone came in on the holiday. The day was not owed, so neither side counts
    // it — otherwise presentDays would outrun workingDays.
    const stats = computeMonthStats(
      records('2026-05-01', '2026-05-04'),
      MAY,
      new Date('2026-05-04T00:00:00Z'),
      null,
      MAY_EXCLUDED
    );

    expect(stats.presentDays).toBe(1);
    expect(stats.attendanceRate).toBeLessThanOrEqual(100);
  });

  it('reads a month that is entirely non-working as no obligation, not 0%', () => {
    // August's elapsed part was the remote week, so nothing was owed at all.
    const remoteWeek = new Set([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
    const stats = computeMonthStats([], '2026-08', null, null, remoteWeek);

    // Only meaningful while today is still inside that week; assert the mechanism
    // rather than the calendar by clamping the range ourselves.
    const owed = computeMonthStats(
      [],
      '2026-08',
      new Date('2026-08-03T00:00:00Z'),
      new Date('2026-08-08T00:00:00Z'),
      remoteWeek
    );
    expect(owed).toEqual({ presentDays: 0, workingDays: 0, attendanceRate: null });
    expect(stats.workingDays).toBeGreaterThanOrEqual(0);
  });

  it('behaves exactly as before when no days are excluded', () => {
    expect(computeMonthStats(records('2026-06-01'), PAST_MONTH, null, null, new Set())).toEqual(
      computeMonthStats(records('2026-06-01'), PAST_MONTH, null)
    );
  });

  it('combines with placedAt: both shrink the same denominator', () => {
    // Owed 1–14 May minus Labour Day = 9 working days, then placed on 15 May.
    const stats = computeMonthStats(
      [],
      MAY,
      null,
      new Date('2026-05-15T00:00:00Z'),
      new Set(['2026-05-01'])
    );

    expect(stats.workingDays).toBe(9);
  });
});

describe('averageAttendanceRate', () => {
  it('averages and rounds', () => {
    expect(averageAttendanceRate([100, 90, 81])).toBe(90);
  });

  it('reads an empty set as 0 instead of NaN', () => {
    expect(averageAttendanceRate([])).toBe(0);
  });

  it('skips nulls rather than counting them as zero', () => {
    // A placed intern owes nothing, so they must not drag the cohort average down.
    expect(averageAttendanceRate([100, null, 90, null, 81])).toBe(90);
  });

  it('reads an all-null set as 0 instead of NaN', () => {
    expect(averageAttendanceRate([null, null])).toBe(0);
  });
});

describe('placementExemptionDate', () => {
  const decidedAt = new Date('2026-06-08T09:30:00Z');
  const startDate = new Date('2026-06-22T00:00:00Z');

  it('exempts from the start date, not the day the placement was decided', () => {
    expect(placementExemptionDate({ outcome: 'placed', decidedAt, startDate })).toEqual(startDate);
  });

  it('exempts nothing while the start date is unknown', () => {
    // The case the field exists for: placed on paper, nobody knows when they
    // begin. They are still on the programme, so they still owe attendance —
    // falling back to `decidedAt` here would forgive the whole gap.
    expect(placementExemptionDate({ outcome: 'placed', decidedAt })).toBeNull();
  });

  it('moves with the start date when it slips', () => {
    const pushedBack = new Date('2026-07-06T00:00:00Z');

    expect(placementExemptionDate({ outcome: 'placed', decidedAt, startDate: pushedBack })).toEqual(
      pushedBack
    );
  });

  it('accepts a start date earlier than the decision', () => {
    // They had already started before anyone recorded the placement.
    const backdated = new Date('2026-06-01T00:00:00Z');

    expect(placementExemptionDate({ outcome: 'placed', decidedAt, startDate: backdated })).toEqual(
      backdated
    );
  });

  it('exempts nothing for a not-placed outcome', () => {
    expect(placementExemptionDate({ outcome: 'not_placed', decidedAt, startDate })).toBeNull();
  });

  it('exempts nothing for a recommendation with no outcome yet', () => {
    expect(placementExemptionDate({})).toBeNull();
    expect(placementExemptionDate(null)).toBeNull();
    expect(placementExemptionDate(undefined)).toBeNull();
  });
});

// A day off is neither attended nor missed. These pin the arithmetic that makes
// that true — a fortnight of approved leave must move the rate not at all.
describe('computeMonthStats — exempt days (vacation, religious holiday, sick)', () => {
  const june = (...days) => days.map((d) => `2026-06-${String(d).padStart(2, '0')}`);

  it('takes an exempt day out of the denominator, exactly like a holiday', () => {
    const stats = computeMonthStats([], PAST_MONTH, null, null, new Set(), june(1, 2, 3));

    expect(stats.workingDays).toBe(PAST_MONTH_WORKING_DAYS - 3);
    expect(stats.presentDays).toBe(0);
  });

  it('leaves a fully-attended month at 100% when part of it was leave', () => {
    // Present on every working day except the three taken as leave.
    const allWorking = [
      1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 29, 30,
    ];
    const leave = june(10, 11, 12);
    const attended = records(...june(...allWorking).filter((d) => !leave.includes(d)));

    const stats = computeMonthStats(attended, PAST_MONTH, null, null, new Set(), leave);

    expect(stats.workingDays).toBe(PAST_MONTH_WORKING_DAYS - 3);
    expect(stats.presentDays).toBe(PAST_MONTH_WORKING_DAYS - 3);
    expect(stats.attendanceRate).toBe(100);
  });

  it('does not punish leave: taking days off cannot lower the rate', () => {
    const attended = records(...june(1, 2, 3, 4, 5));
    const without = computeMonthStats(attended, PAST_MONTH, null, null, new Set(), []);
    const withLeave = computeMonthStats(attended, PAST_MONTH, null, null, new Set(), june(8, 9));

    expect(withLeave.attendanceRate).toBeGreaterThan(without.attendanceRate);
  });

  it('never counts an exempt day as attended, even if a record shares the date', () => {
    // Defensive: splitRows keeps these apart, so a date in both lists is a bug
    // upstream. The rate must still not exceed 100%.
    const stats = computeMonthStats(
      records(...june(1, 2)),
      PAST_MONTH,
      null,
      null,
      new Set(),
      june(1, 2)
    );

    expect(stats.presentDays).toBe(0);
    expect(stats.workingDays).toBe(PAST_MONTH_WORKING_DAYS - 2);
  });

  it('accepts a Set as readily as an array', () => {
    const asArray = computeMonthStats([], PAST_MONTH, null, null, new Set(), june(1, 2));
    const asSet = computeMonthStats([], PAST_MONTH, null, null, new Set(), new Set(june(1, 2)));

    expect(asSet).toEqual(asArray);
  });

  it('is a no-op when nothing is exempt, so the pt.1 callers are unaffected', () => {
    const attended = records(...june(1, 2));

    expect(computeMonthStats(attended, PAST_MONTH, null, null, new Set(), [])).toEqual(
      computeMonthStats(attended, PAST_MONTH, null)
    );
  });

  it('does not double-count a day that is both a cohort holiday and personal leave', () => {
    const holiday = new Set(june(1));
    const stats = computeMonthStats([], PAST_MONTH, null, null, holiday, june(1, 2));

    expect(stats.workingDays).toBe(PAST_MONTH_WORKING_DAYS - 2);
  });
});

describe('splitRows', () => {
  const row = (date, status, checkedInAt = new Date('2026-06-01T08:00:00Z')) => ({
    date,
    status,
    checkedInAt,
  });

  it('sorts each status into the bucket that decides its arithmetic', () => {
    const {
      records: attended,
      cancelledDates,
      exemptDates,
    } = splitRows([
      row('2026-06-01', 'present'),
      row('2026-06-02', 'remote'),
      row('2026-06-03', 'vacation'),
      row('2026-06-04', 'religious'),
      row('2026-06-05', 'sick'),
      row('2026-06-08', 'cancelled'),
    ]);

    expect(attended.map((r) => r.date)).toEqual(['2026-06-01', '2026-06-02']);
    expect(exemptDates).toEqual(['2026-06-03', '2026-06-04', '2026-06-05']);
    expect(cancelledDates).toEqual(['2026-06-08']);
  });

  it('maps every request-written day to its status for the calendar', () => {
    const { requestedDays } = splitRows([
      row('2026-06-01', 'present'),
      row('2026-06-02', 'remote'),
      row('2026-06-03', 'vacation'),
    ]);

    // `present` is the intern's own check-in and stands behind no request.
    expect(requestedDays).toEqual({ '2026-06-02': 'remote', '2026-06-03': 'vacation' });
  });

  it('never reports an approval timestamp as a check-in', () => {
    const early = new Date('2026-06-01T07:30:00Z');
    const late = new Date('2026-06-02T15:00:00Z');

    const { lastCheckIn } = splitRows([
      row('2026-06-01', 'present', early),
      row('2026-06-02', 'remote', late),
    ]);

    expect(lastCheckIn).toEqual(early);
  });

  it('reports no check-in at all for a month of pure leave', () => {
    const { lastCheckIn, records: attended } = splitRows([
      row('2026-06-03', 'vacation'),
      row('2026-06-04', 'sick'),
    ]);

    expect(lastCheckIn).toBeNull();
    expect(attended).toEqual([]);
  });
});
