// The client half of the placement exemption. `placedAt` covers the placement an
// intern is on right now; `placementExemptions` covers the ones they already came
// back from. Both must classify as EXEMPT, or the calendar draws a finished
// placement as a wall of absences the intern never owed — and the derived week and
// month rates on the same screens would then contradict the server's percentage.
//
// These assertions mirror `server/helpers/attendanceStats.test.js`. When one side
// changes, change both: a client that disagrees with `computeMonthStats` shows the
// user two different answers to the same question.
import { describe, expect, it } from 'vitest';
import { DAY_STATUS, classifyDay, placementExemptKeySet, stripAttendance } from './attendance';

// 8–19 June 2026 on a project (two full working weeks), back on Monday the 22nd.
const RETURNED_STINT = [{ from: '2026-06-08', to: '2026-06-22' }];
const day = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const NOW = day('2026-07-15');

describe('placementExemptKeySet', () => {
  it('expands a stint as half-open [from, to)', () => {
    const keys = placementExemptKeySet([{ from: '2026-06-08', to: '2026-06-11' }]);

    expect([...keys].sort()).toEqual(['2026-06-08', '2026-06-09', '2026-06-10']);
  });

  it('leaves weekends out — they were never anyone’s working day', () => {
    // 8–15 June 2026 spans the Sat/Sun of 13–14.
    const keys = placementExemptKeySet([{ from: '2026-06-08', to: '2026-06-15' }]);

    expect([...keys].sort()).toEqual([
      '2026-06-08',
      '2026-06-09',
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
    ]);
  });

  it('expands nothing for a placement that never began', () => {
    expect(placementExemptKeySet([{ from: '2026-06-08', to: '2026-06-08' }]).size).toBe(0);
  });

  it('expands every stint when there is more than one', () => {
    const keys = placementExemptKeySet([
      { from: '2026-06-08', to: '2026-06-09' },
      { from: '2026-06-22', to: '2026-06-23' },
    ]);

    expect([...keys].sort()).toEqual(['2026-06-08', '2026-06-22']);
  });

  it('tolerates missing and malformed input rather than throwing', () => {
    expect(placementExemptKeySet().size).toBe(0);
    expect(placementExemptKeySet([]).size).toBe(0);
    expect(placementExemptKeySet([{ from: '2026-06-08', to: null }]).size).toBe(0);
    expect(placementExemptKeySet([{ from: null, to: '2026-06-08' }]).size).toBe(0);
    // Inverted bounds expand to nothing instead of spinning.
    expect(placementExemptKeySet([{ from: '2026-06-22', to: '2026-06-08' }]).size).toBe(0);
  });
});

describe('classifyDay — a placement already returned from', () => {
  const keys = placementExemptKeySet(RETURNED_STINT);
  const classify = (key, presentKeys = new Set()) =>
    classifyDay(day(key), presentKeys, new Set(), NOW, null, undefined, null, undefined, keys);

  it('reads a day inside the stretch as EXEMPT, not ABSENT', () => {
    expect(classify('2026-06-10')).toBe(DAY_STATUS.EXEMPT);
  });

  it('reads the day they returned as owed', () => {
    // Half-open: `to` is the day attendance resumed, so it is a normal working day.
    expect(classify('2026-06-22')).toBe(DAY_STATUS.ABSENT);
  });

  it('reads the day before the placement as owed', () => {
    expect(classify('2026-06-05')).toBe(DAY_STATUS.ABSENT);
  });

  it('outranks a stray check-in inside the stretch', () => {
    // The server drops such a record from the rate, so showing it as counted
    // attendance would have the cell disagree with the percentage above it.
    expect(classify('2026-06-10', new Set(['2026-06-10']))).toBe(DAY_STATUS.EXEMPT);
  });

  it('still reports a real check-in outside the stretch as present', () => {
    expect(classify('2026-06-23', new Set(['2026-06-23']))).toBe(DAY_STATUS.PRESENT);
  });

  it('leaves every other day unchanged when there are no stints', () => {
    expect(classifyDay(day('2026-06-10'), new Set(), new Set(), NOW)).toBe(DAY_STATUS.ABSENT);
  });

  it('still reads a weekend inside the stretch as WEEKEND, not "On project"', () => {
    // 13/14 June 2026 are Sat/Sun, inside the 8–19 June placement. Labelling them
    // EXEMPT reads as days the intern worked, and a three-week placement would paint
    // six of them.
    expect(classify('2026-06-13')).toBe(DAY_STATUS.WEEKEND);
    expect(classify('2026-06-14')).toBe(DAY_STATUS.WEEKEND);
  });

  it('reads a weekend under an OPEN placement as WEEKEND too', () => {
    // Same rule for `placedAt`, so the two halves of the same fact cannot disagree.
    expect(classifyDay(day('2026-06-13'), new Set(), new Set(), NOW, '2026-06-08')).toBe(
      DAY_STATUS.WEEKEND
    );
    expect(classifyDay(day('2026-06-10'), new Set(), new Set(), NOW, '2026-06-08')).toBe(
      DAY_STATUS.EXEMPT
    );
  });
});

describe('stripAttendance — exempt days are inert', () => {
  it('keeps a returned-from placement out of the denominator', () => {
    // The week of 8 June: entirely inside the stretch, so nothing was owed and
    // nothing was missed. A "0 of 5" here would be the fabricated absence again.
    const keys = placementExemptKeySet(RETURNED_STINT);
    const week = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'].map(
      (key) => ({
        key,
        status: classifyDay(
          day(key),
          new Set(),
          new Set(),
          NOW,
          null,
          undefined,
          null,
          undefined,
          keys
        ),
      })
    );

    expect(stripAttendance(week)).toMatchObject({ present: 0, elapsed: 0, workingDays: 0 });
  });

  it('counts the days either side of the stretch normally', () => {
    const keys = placementExemptKeySet(RETURNED_STINT);
    const present = new Set(['2026-06-04', '2026-06-05']);
    const strip = ['2026-06-04', '2026-06-05', '2026-06-08', '2026-06-09'].map((key) => ({
      key,
      status: classifyDay(
        day(key),
        present,
        new Set(),
        NOW,
        null,
        undefined,
        null,
        undefined,
        keys
      ),
    }));

    expect(stripAttendance(strip)).toMatchObject({ present: 2, elapsed: 2, workingDays: 2 });
  });
});
