const {
  MAX_DAYS_PER_REQUEST,
  isOutstanding,
  claimedDays,
  normaliseDates,
  requestDayRefusal,
  createRequestRefusal,
} = require('./remoteWorkRules');

// Every case pins `todayKey` explicitly so the suite cannot drift as real time
// passes — the helpers default to the office's today, which would make "is this
// day in the past" a moving target.
// Week of Mon 2026-06-15 … Fri 2026-06-19. Sat/Sun are 20/21.
const TODAY = '2026-06-17'; // Wednesday
const TOMORROW = '2026-06-18';
const YESTERDAY = '2026-06-16';
const SATURDAY = '2026-06-20';

const req =
  (status) =>
  (...dates) => ({ dates, status });
const pending = req('pending');
const approved = req('approved');
const rejected = req('rejected');
const cancelled = req('cancelled');
const revoked = req('revoked');

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
    expect(isOutstanding(approved('2026-06-15', YESTERDAY), TODAY)).toBe(false);
  });

  it('never counts a spent request', () => {
    expect(isOutstanding(rejected(TOMORROW), TODAY)).toBe(false);
    expect(isOutstanding(cancelled(TOMORROW), TODAY)).toBe(false);
    expect(isOutstanding(revoked(TOMORROW), TODAY)).toBe(false);
  });
});

describe('claimedDays', () => {
  it('maps each live day to the status holding it', () => {
    const claimed = claimedDays([pending(TOMORROW), approved('2026-06-19')], TODAY);

    expect(claimed.get(TOMORROW)).toBe('pending');
    expect(claimed.get('2026-06-19')).toBe('approved');
  });

  it('ignores spent requests, so a refused day is free again', () => {
    expect(claimedDays([rejected(TOMORROW), cancelled(TOMORROW)], TODAY).size).toBe(0);
  });

  it('lets an approval outrank a pending claim on the same day', () => {
    const claimed = claimedDays([pending(TOMORROW), approved(TOMORROW)], TODAY);

    expect(claimed.get(TOMORROW)).toBe('approved');
  });
});

describe('requestDayRefusal', () => {
  const ctx = { todayKey: TODAY };

  it('allows today and any future working day', () => {
    expect(requestDayRefusal(TODAY, ctx)).toBeNull();
    expect(requestDayRefusal(TOMORROW, ctx)).toBeNull();
  });

  it('refuses a past day, so an absence cannot be relabelled after the fact', () => {
    expect(requestDayRefusal(YESTERDAY, ctx)).toMatch(/today or a future day/i);
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

// The rules the developer asked to be tested well: a request covers 1, 2 or 3
// days and no more, and wanting a fourth means submitting another request.
describe('createRequestRefusal — the 3-day ceiling', () => {
  const ctx = { todayKey: TODAY };

  it.each([
    ['one day', ['2026-06-18']],
    ['two days', ['2026-06-18', '2026-06-19']],
    ['three days', ['2026-06-18', '2026-06-19', '2026-06-22']],
  ])('allows %s in one request', (_label, dates) => {
    expect(createRequestRefusal(dates, ctx)).toBeNull();
  });

  it(`refuses ${MAX_DAYS_PER_REQUEST + 1} days and points at making another request`, () => {
    const refusal = createRequestRefusal(
      ['2026-06-18', '2026-06-19', '2026-06-22', '2026-06-23'],
      ctx
    );

    expect(refusal).toMatch(/at most 3 days/i);
    expect(refusal).toMatch(/another request/i);
  });

  it('refuses an empty request', () => {
    expect(createRequestRefusal([], ctx)).toMatch(/at least one day/i);
    expect(createRequestRefusal(undefined, ctx)).toMatch(/at least one day/i);
  });

  it('counts duplicates once, so a repeated pick is not a fourth day', () => {
    const dates = ['2026-06-18', '2026-06-18', '2026-06-19', '2026-06-22'];

    expect(normaliseDates(dates)).toHaveLength(3);
    expect(createRequestRefusal(dates, ctx)).toBeNull();
  });

  it('does not require the days to be consecutive', () => {
    expect(createRequestRefusal(['2026-06-18', '2026-06-25'], ctx)).toBeNull();
  });
});

describe('createRequestRefusal — no limit on how many requests', () => {
  const ctx = { todayKey: TODAY };

  // Exam week: 3 days, then 2 more. The ceiling is per request, never per intern.
  it('allows a fourth and fifth day through a second request', () => {
    const first = ['2026-06-22', '2026-06-23', '2026-06-24'];
    expect(createRequestRefusal(first, ctx)).toBeNull();

    const existingRequests = [pending(...first)];
    expect(
      createRequestRefusal(['2026-06-25', '2026-06-26'], { ...ctx, existingRequests })
    ).toBeNull();
  });

  it('keeps allowing requests well past three outstanding days', () => {
    const existingRequests = [
      approved('2026-06-18', '2026-06-19'),
      pending('2026-06-22', '2026-06-23', '2026-06-24'),
      pending('2026-06-25'),
    ];

    expect(createRequestRefusal(['2026-06-26'], { ...ctx, existingRequests })).toBeNull();
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
      /already approved/i
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
    const existingRequests = [approved('2026-06-15', YESTERDAY)];

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
});
