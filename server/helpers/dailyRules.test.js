const { previousWorkingDay, isDailyEditable, deriveCounts } = require('./dailyRules');

// Fixed calendar anchors (local midnight, month is 0-indexed):
//   Fri 2026-01-02, Mon 2026-01-05, Tue 2026-01-06, Wed 2026-01-07
const FRIDAY = new Date(2026, 0, 2);
const MONDAY = new Date(2026, 0, 5);
const TUESDAY = new Date(2026, 0, 6);
const WEDNESDAY = new Date(2026, 0, 7);

describe('previousWorkingDay', () => {
  it('maps Monday back to the prior Friday (skips the weekend)', () => {
    expect(previousWorkingDay(MONDAY).getTime()).toBe(FRIDAY.getTime());
  });

  it('maps a mid-week day back to the prior day', () => {
    expect(previousWorkingDay(WEDNESDAY).getTime()).toBe(TUESDAY.getTime());
  });
});

describe('isDailyEditable', () => {
  it('today is editable', () => {
    expect(isDailyEditable(WEDNESDAY, WEDNESDAY)).toBe(true);
  });

  it('Monday can still edit Friday (one working day back, weekend skipped)', () => {
    expect(isDailyEditable(FRIDAY, MONDAY)).toBe(true);
  });

  it('two working days back is not editable', () => {
    // now = Wednesday, editing Monday: earliest editable is Tuesday.
    expect(isDailyEditable(MONDAY, WEDNESDAY)).toBe(false);
  });

  it('a future date is not editable', () => {
    expect(isDailyEditable(TUESDAY, MONDAY)).toBe(false);
  });

  it('ignores the time-of-day component (start-of-day comparison)', () => {
    const wednesdayLate = new Date(2026, 0, 7, 23, 59, 59);
    const wednesdayEarly = new Date(2026, 0, 7, 8, 0, 0);
    expect(isDailyEditable(wednesdayLate, wednesdayEarly)).toBe(true);
  });
});

describe('deriveCounts', () => {
  it('sums done/todo/blocker items and reports the covered ratio', () => {
    const entries = [
      { done: ['a', 'b'], todo: ['x'], blockers: [{ text: 'blocked' }] },
      { done: ['c'], todo: ['y', 'z'], blockers: [{ text: 'b1' }, { text: 'b2' }] },
    ];

    expect(deriveCounts(entries, 6)).toEqual({
      covered: { present: 2, total: 6 },
      shipped: 3,
      inFlight: 3,
      blockers: 3,
    });
  });

  it('returns zeros for an empty daily', () => {
    expect(deriveCounts([], 4)).toEqual({
      covered: { present: 0, total: 4 },
      shipped: 0,
      inFlight: 0,
      blockers: 0,
    });
  });

  it('defaults the active-intern total to zero when omitted', () => {
    expect(deriveCounts([]).covered).toEqual({ present: 0, total: 0 });
  });
});
