const {
  yearOf,
  isOutstanding,
  claimedDays,
  usedDaysByYear,
  budgetStateFor,
  earliestRequestableKey,
  normaliseDates,
  requestDayRefusal,
  budgetRefusal,
  createRequestRefusal,
} = require('./attendanceRequestRules');
const { maxDaysFor, yearlyBudgetFor } = require('../constants/attendanceRequestTypes');

// Every case pins `todayKey` explicitly so the suite cannot drift as real time
// passes — the helpers default to the office's today, which would make "is this day
// in the past" a moving target.
// Week of Mon 2026-06-15 … Fri 2026-06-19. Sat/Sun are 20/21.
const TODAY = '2026-06-17'; // Wednesday
const TOMORROW = '2026-06-18';
const YESTERDAY = '2026-06-16'; // Tuesday
const TWO_BACK = '2026-06-15'; // Monday
const THREE_BACK = '2026-06-12'; // the Friday before
const SATURDAY = '2026-06-20';

// Requests default to `remote` so the pt.1 cases read exactly as they did.
const req =
  (status) =>
  (...dates) => ({ dates, status, type: 'remote' });
const pending = req('pending');
const approved = req('approved');
const rejected = req('rejected');
const cancelled = req('cancelled');
const revoked = req('revoked');

const typed = (type, status, ...dates) => ({ dates, status, type });

describe('normaliseDates', () => {
  it('sorts, de-duplicates and drops blanks', () => {
    expect(normaliseDates(['2026-06-19', '', '2026-06-17', '2026-06-19', null])).toEqual([
      '2026-06-17',
      '2026-06-19',
    ]);
  });

  it('treats anything that is not an array as empty', () => {
    expect(normaliseDates(undefined)).toEqual([]);
    expect(normaliseDates('2026-06-17')).toEqual([]);
  });
});

describe('yearOf', () => {
  it('reads the calendar year a day is charged to', () => {
    expect(yearOf('2026-12-31')).toBe('2026');
    expect(yearOf('2027-01-01')).toBe('2027');
  });
});

describe('isOutstanding', () => {
  it('counts a pending request whatever its dates', () => {
    expect(isOutstanding(pending(TOMORROW), TODAY)).toBe(true);
    expect(isOutstanding(pending(YESTERDAY), TODAY)).toBe(true);
  });

  it('counts an approved request while any of its days is still ahead', () => {
    expect(isOutstanding(approved(YESTERDAY, TOMORROW), TODAY)).toBe(true);
    expect(isOutstanding(approved(TODAY), TODAY)).toBe(true);
  });

  it('releases an approved request once every day has elapsed', () => {
    expect(isOutstanding(approved(TWO_BACK, YESTERDAY), TODAY)).toBe(false);
  });

  it('never counts a spent request', () => {
    expect(isOutstanding(rejected(TOMORROW), TODAY)).toBe(false);
    expect(isOutstanding(cancelled(TOMORROW), TODAY)).toBe(false);
    expect(isOutstanding(revoked(TOMORROW), TODAY)).toBe(false);
  });
});

describe('claimedDays', () => {
  it('maps each live day to the status and type holding it', () => {
    const claimed = claimedDays([pending(TOMORROW), approved('2026-06-19')], TODAY);

    expect(claimed.get(TOMORROW)).toEqual({ status: 'pending', type: 'remote' });
    expect(claimed.get('2026-06-19')).toEqual({ status: 'approved', type: 'remote' });
  });

  it('ignores spent requests, so a refused day is free again', () => {
    expect(claimedDays([rejected(TOMORROW), cancelled(TOMORROW)], TODAY).size).toBe(0);
  });

  it('lets an approval outrank a pending claim on the same day', () => {
    const claimed = claimedDays([pending(TOMORROW), approved(TOMORROW)], TODAY);

    expect(claimed.get(TOMORROW).status).toBe('approved');
  });

  it('claims across types, so one day cannot be two kinds of away at once', () => {
    const claimed = claimedDays([typed('vacation', 'pending', TOMORROW)], TODAY);

    expect(claimed.get(TOMORROW)).toEqual({ status: 'pending', type: 'vacation' });
  });
});

describe('requestDayRefusal — rules that apply to every type', () => {
  const ctx = { todayKey: TODAY };

  it('allows today and any future working day', () => {
    expect(requestDayRefusal(TODAY, ctx)).toBeNull();
    expect(requestDayRefusal(TOMORROW, ctx)).toBeNull();
  });

  it('refuses a weekend', () => {
    expect(requestDayRefusal(SATURDAY, ctx)).toMatch(/working day/i);
  });

  it('refuses a cohort-wide non-working day', () => {
    expect(requestDayRefusal(TOMORROW, { ...ctx, nonWorkingKeys: new Set([TOMORROW]) })).toMatch(
      /non-working day for everyone/i
    );
  });

  it('refuses a day before the intern joined', () => {
    expect(requestDayRefusal(TOMORROW, { ...ctx, startKey: '2026-07-01' })).toMatch(
      /before you joined/i
    );
  });

  it('refuses the placement start date itself and everything after it', () => {
    expect(requestDayRefusal(TOMORROW, { ...ctx, placedAtKey: TOMORROW })).toMatch(/on a project/i);
    expect(requestDayRefusal('2026-06-19', { ...ctx, placedAtKey: TOMORROW })).toMatch(
      /on a project/i
    );
  });

  it('allows a day before the placement starts', () => {
    expect(requestDayRefusal(TODAY, { ...ctx, placedAtKey: TOMORROW })).toBeNull();
  });

  it('refuses a day that already has an attendance row', () => {
    expect(requestDayRefusal(TODAY, { ...ctx, takenKeys: new Set([TODAY]) })).toMatch(
      /already recorded/i
    );
  });

  it('refuses a malformed date', () => {
    expect(requestDayRefusal('17/06/2026', ctx)).toMatch(/valid date/i);
    expect(requestDayRefusal(null, ctx)).toMatch(/valid date/i);
  });
});

describe('requestDayRefusal — the past, per type', () => {
  const ctx = { todayKey: TODAY };

  it.each(['remote', 'vacation', 'religious'])(
    'refuses a past day for %s, so an absence cannot be relabelled after the fact',
    (type) => {
      expect(requestDayRefusal(YESTERDAY, { ...ctx, type })).toMatch(/today or a future day/i);
    }
  );

  it('lets a sick day reach back two working days', () => {
    expect(requestDayRefusal(TODAY, { ...ctx, type: 'sick' })).toBeNull();
    expect(requestDayRefusal(YESTERDAY, { ...ctx, type: 'sick' })).toBeNull();
    expect(requestDayRefusal(TWO_BACK, { ...ctx, type: 'sick' })).toBeNull();
  });

  it('stops a sick day at the third working day back', () => {
    expect(requestDayRefusal(THREE_BACK, { ...ctx, type: 'sick' })).toMatch(/last 2 working days/i);
  });

  it('counts the window in working days, so a weekend does not consume it', () => {
    // Monday 2026-06-22: two working days back is Thu 18th, not Sat 20th.
    const monday = { todayKey: '2026-06-22', type: 'sick' };
    expect(requestDayRefusal('2026-06-18', monday)).toBeNull();
    expect(requestDayRefusal('2026-06-17', monday)).toMatch(/last 2 working days/i);
  });

  it('skips a cohort holiday when counting the window back', () => {
    // Thursday, with Wednesday a holiday: two working days back reaches Monday.
    const ctxHoliday = {
      todayKey: '2026-06-18',
      type: 'sick',
      nonWorkingKeys: new Set(['2026-06-17']),
    };
    expect(requestDayRefusal('2026-06-15', ctxHoliday)).toBeNull();
    expect(requestDayRefusal('2026-06-12', ctxHoliday)).toMatch(/last 2 working days/i);
  });

  it('refuses a sick day in the future — you cannot book being ill', () => {
    expect(requestDayRefusal(TOMORROW, { ...ctx, type: 'sick' })).toMatch(/already started/i);
  });
});

describe('earliestRequestableKey', () => {
  it('is today for every type that cannot be backdated', () => {
    for (const type of ['remote', 'vacation', 'religious']) {
      expect(earliestRequestableKey(type, TODAY)).toBe(TODAY);
    }
  });

  it('reaches back two working days for sick', () => {
    expect(earliestRequestableKey('sick', TODAY)).toBe(TWO_BACK);
  });
});

// The rules the developer asked to be tested well. Three bounds a *request*, not an
// intern — wanting a fourth day means submitting another one.
describe('createRequestRefusal — the per-request ceiling', () => {
  const ctx = { todayKey: TODAY };

  it.each([
    ['one day', ['2026-06-18']],
    ['two days', ['2026-06-18', '2026-06-19']],
    ['three days', ['2026-06-18', '2026-06-19', '2026-06-22']],
  ])('allows %s in one remote request', (_label, dates) => {
    expect(createRequestRefusal(dates, ctx)).toBeNull();
  });

  it('refuses a fourth remote day and points at making another request', () => {
    const refusal = createRequestRefusal(
      ['2026-06-18', '2026-06-19', '2026-06-22', '2026-06-23'],
      ctx
    );

    expect(refusal).toMatch(/at most 3 days/i);
    expect(refusal).toMatch(/another request/i);
  });

  it('lets vacation reach five days in one request', () => {
    const week = ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26'];

    expect(maxDaysFor('vacation')).toBe(5);
    expect(createRequestRefusal(week, { ...ctx, type: 'vacation' })).toBeNull();
  });

  it('refuses a sixth vacation day in one request', () => {
    const six = [
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
      '2026-06-26',
      '2026-06-29',
    ];

    expect(createRequestRefusal(six, { ...ctx, type: 'vacation' })).toMatch(/at most 5 days/i);
  });

  it('holds religious to three days in one request', () => {
    expect(
      createRequestRefusal(['2026-06-22', '2026-06-23', '2026-06-24'], {
        ...ctx,
        type: 'religious',
      })
    ).toBeNull();
    expect(
      createRequestRefusal(['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25'], {
        ...ctx,
        type: 'religious',
      })
    ).toMatch(/at most 3 days/i);
  });

  it('holds sick to a single day, and says so in the singular', () => {
    expect(maxDaysFor('sick')).toBe(1);
    expect(createRequestRefusal([TODAY], { ...ctx, type: 'sick' })).toBeNull();

    const refusal = createRequestRefusal([YESTERDAY, TODAY], { ...ctx, type: 'sick' });
    expect(refusal).toMatch(/single day/i);
    expect(refusal).toMatch(/another request/i);
  });

  it('refuses an empty request', () => {
    expect(createRequestRefusal([], ctx)).toMatch(/at least one day/i);
    expect(createRequestRefusal(undefined, ctx)).toMatch(/at least one day/i);
  });

  it('refuses an unknown type before looking at anything else', () => {
    expect(createRequestRefusal([TOMORROW], { ...ctx, type: 'sabbatical' })).toMatch(
      /what kind of day/i
    );
  });

  it('counts duplicates once, so a repeated pick is not an extra day', () => {
    const dates = ['2026-06-18', '2026-06-18', '2026-06-19', '2026-06-22'];

    expect(normaliseDates(dates)).toHaveLength(3);
    expect(createRequestRefusal(dates, ctx)).toBeNull();
  });

  it('does not require the days to be consecutive', () => {
    expect(createRequestRefusal(['2026-06-18', '2026-06-25'], ctx)).toBeNull();
  });
});

describe('createRequestRefusal — no limit on how many remote or sick requests', () => {
  const ctx = { todayKey: TODAY };

  // Exam week: 3 days, then 2 more. The ceiling is per request, never per intern.
  it('allows a fourth and fifth remote day through a second request', () => {
    const first = ['2026-06-22', '2026-06-23', '2026-06-24'];
    expect(createRequestRefusal(first, ctx)).toBeNull();

    const existingRequests = [pending(...first)];
    expect(
      createRequestRefusal(['2026-06-25', '2026-06-26'], { ...ctx, existingRequests })
    ).toBeNull();
  });

  it('keeps allowing remote requests well past three outstanding days', () => {
    const existingRequests = [
      approved('2026-06-18', '2026-06-19'),
      pending('2026-06-22', '2026-06-23', '2026-06-24'),
      pending('2026-06-25'),
    ];

    expect(createRequestRefusal(['2026-06-26'], { ...ctx, existingRequests })).toBeNull();
  });

  it('never budgets sick days, however many have been taken', () => {
    expect(yearlyBudgetFor('sick')).toBeNull();

    const existingRequests = Array.from({ length: 12 }, (_, i) =>
      typed('sick', 'approved', `2026-03-${String(i + 2).padStart(2, '0')}`)
    );

    expect(createRequestRefusal([TODAY], { ...ctx, type: 'sick', existingRequests })).toBeNull();
  });
});

describe('usedDaysByYear and budgetStateFor', () => {
  it('counts pending and approved, and releases everything else', () => {
    const requests = [
      typed('vacation', 'approved', '2026-02-02', '2026-02-03'),
      typed('vacation', 'pending', '2026-08-10'),
      typed('vacation', 'rejected', '2026-09-01', '2026-09-02'),
      typed('vacation', 'cancelled', '2026-09-03'),
      typed('vacation', 'revoked', '2026-09-04'),
    ];

    expect(usedDaysByYear(requests, 'vacation').get('2026')).toBe(3);
  });

  it('keeps each type to its own allowance', () => {
    const requests = [
      typed('vacation', 'approved', '2026-02-02'),
      typed('religious', 'approved', '2026-03-02', '2026-03-03'),
    ];

    expect(usedDaysByYear(requests, 'vacation').get('2026')).toBe(1);
    expect(usedDaysByYear(requests, 'religious').get('2026')).toBe(2);
  });

  it('charges each day to the year it falls in', () => {
    const straddling = [typed('vacation', 'approved', '2026-12-30', '2026-12-31', '2027-01-04')];
    const used = usedDaysByYear(straddling, 'vacation');

    expect(used.get('2026')).toBe(2);
    expect(used.get('2027')).toBe(1);
  });

  it('reports what is left for the UI, and null when there is no budget', () => {
    const requests = [typed('vacation', 'approved', '2026-02-02', '2026-02-03')];

    expect(budgetStateFor('vacation', '2026', requests)).toEqual({
      budget: 5,
      used: 2,
      remaining: 3,
    });
    expect(budgetStateFor('vacation', '2027', requests)).toEqual({
      budget: 5,
      used: 0,
      remaining: 5,
    });
    expect(budgetStateFor('remote', '2026', requests)).toBeNull();
    expect(budgetStateFor('sick', '2026', requests)).toBeNull();
  });
});

describe('budgetRefusal — the yearly lock', () => {
  const ctx = { todayKey: TODAY };
  const spent = (type, count, startDay = 2) =>
    typed(
      type,
      'approved',
      ...Array.from({ length: count }, (_, i) => `2026-02-${String(startDay + i).padStart(2, '0')}`)
    );

  it('allows a request that exactly exhausts the allowance', () => {
    const existingRequests = [spent('vacation', 3)];

    expect(
      createRequestRefusal(['2026-06-22', '2026-06-23'], {
        ...ctx,
        type: 'vacation',
        existingRequests,
      })
    ).toBeNull();
  });

  it('locks vacation once all five days are spent', () => {
    const existingRequests = [spent('vacation', 5)];

    expect(
      createRequestRefusal(['2026-06-22'], { ...ctx, type: 'vacation', existingRequests })
    ).toMatch(/used all 5 of your vacation days for 2026/i);
  });

  it('says how many are left when the request only partly fits', () => {
    const existingRequests = [spent('vacation', 4)];

    expect(
      createRequestRefusal(['2026-06-22', '2026-06-23'], {
        ...ctx,
        type: 'vacation',
        existingRequests,
      })
    ).toMatch(/you have 1 left/i);
  });

  it('locks religious at three days a year', () => {
    const existingRequests = [spent('religious', 3)];

    expect(
      createRequestRefusal(['2026-06-22'], { ...ctx, type: 'religious', existingRequests })
    ).toMatch(/used all 3 of your religious holiday days for 2026/i);
  });

  it('holds budget against a pending request, so five of them cannot be approved', () => {
    const existingRequests = [typed('vacation', 'pending', '2026-06-22', '2026-06-23')];

    expect(
      budgetRefusal(
        'vacation',
        ['2026-06-24', '2026-06-25', '2026-06-26', '2026-06-29'],
        existingRequests
      )
    ).toMatch(/you have 3 left/i);
  });

  it('gives the days back when a request is rejected', () => {
    const existingRequests = [typed('vacation', 'rejected', '2026-02-02', '2026-02-03')];

    expect(budgetStateFor('vacation', '2026', existingRequests).remaining).toBe(5);
  });

  it('gives the days back when an approval is revoked', () => {
    const existingRequests = [typed('vacation', 'revoked', '2026-02-02', '2026-02-03')];

    expect(budgetStateFor('vacation', '2026', existingRequests).remaining).toBe(5);
  });

  it('unlocks the option in the new year', () => {
    const existingRequests = [spent('vacation', 5)];

    expect(
      createRequestRefusal(['2027-01-04', '2027-01-05'], {
        ...ctx,
        type: 'vacation',
        existingRequests,
      })
    ).toBeNull();
  });

  it('refuses only the short side of a request straddling New Year', () => {
    // Four days already spent in 2026, none in 2027.
    const existingRequests = [spent('vacation', 4)];
    const straddling = ['2026-12-30', '2026-12-31', '2027-01-04'];

    // 2026 wants 2 and has 1 left → refused, and the message names 2026.
    const refusal = createRequestRefusal(straddling, {
      ...ctx,
      type: 'vacation',
      existingRequests,
    });
    expect(refusal).toMatch(/2026/);

    // Drop one 2026 day and it fits on both sides.
    expect(
      createRequestRefusal(['2026-12-31', '2027-01-04'], {
        ...ctx,
        type: 'vacation',
        existingRequests,
      })
    ).toBeNull();
  });

  it('never budgets remote, however many days are approved', () => {
    const existingRequests = [spent('remote', 20)];

    expect(budgetRefusal('remote', ['2026-06-22'], existingRequests)).toBeNull();
  });
});

describe('createRequestRefusal — clashes with existing requests', () => {
  const ctx = { todayKey: TODAY };

  it('refuses a day already waiting on a decision', () => {
    const existingRequests = [pending(TOMORROW)];

    expect(createRequestRefusal([TOMORROW], { ...ctx, existingRequests })).toMatch(
      /waiting on a decision/i
    );
  });

  it('names an existing approval rather than calling it a pending clash', () => {
    const existingRequests = [approved(TOMORROW)];

    expect(createRequestRefusal([TOMORROW], { ...ctx, existingRequests })).toMatch(
      /already have an approved remote work day/i
    );
  });

  it('names the type that is in the way, across types', () => {
    const existingRequests = [typed('vacation', 'approved', TOMORROW)];

    expect(createRequestRefusal([TOMORROW], { ...ctx, type: 'remote', existingRequests })).toMatch(
      /approved vacation day/i
    );
  });

  it('refuses the whole request when only one of its days clashes', () => {
    const existingRequests = [pending('2026-06-19')];

    expect(
      createRequestRefusal(['2026-06-18', '2026-06-19', '2026-06-22'], { ...ctx, existingRequests })
    ).toMatch(/waiting on a decision/i);
  });

  it('lets a day be requested again after the earlier request was refused', () => {
    const existingRequests = [rejected(TOMORROW), cancelled(TOMORROW), revoked(TOMORROW)];

    expect(createRequestRefusal([TOMORROW], { ...ctx, existingRequests })).toBeNull();
  });

  it('stops blocking once every day of the earlier approval has elapsed', () => {
    const existingRequests = [approved(TWO_BACK, YESTERDAY)];

    expect(createRequestRefusal([TOMORROW], { ...ctx, existingRequests })).toBeNull();
  });

  it('applies the size bound before anything else', () => {
    const existingRequests = [pending(TOMORROW)];

    expect(
      createRequestRefusal([TOMORROW, SATURDAY, '2026-06-22', '2026-06-23'], {
        ...ctx,
        existingRequests,
      })
    ).toMatch(/at most 3 days/i);
  });

  it('refuses the whole request when one day is invalid on its own', () => {
    expect(createRequestRefusal(['2026-06-18', SATURDAY], ctx)).toMatch(/working day/i);
    expect(createRequestRefusal([YESTERDAY, '2026-06-18'], ctx)).toMatch(/today or a future day/i);
  });

  it('reports a bad day before reporting the budget', () => {
    // Over budget AND containing a Saturday: the fixable-day message comes first.
    const existingRequests = [
      typed('vacation', 'approved', '2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05'),
    ];

    expect(
      createRequestRefusal(['2026-06-22', SATURDAY], {
        ...ctx,
        type: 'vacation',
        existingRequests,
      })
    ).toMatch(/working day/i);
  });
});
