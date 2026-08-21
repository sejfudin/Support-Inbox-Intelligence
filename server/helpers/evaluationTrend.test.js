const {
  EVALUATION_CRITERIA,
  averageScore,
  averageDelta,
  criterionTrends,
} = require('./evaluationTrend');

const scores = (attrs = {}) => ({
  technical: 3,
  communication: 3,
  ownership: 3,
  growth: 3,
  ...attrs,
});

const evaluation = (attrs = {}) => ({ scores: scores(attrs) });

describe('averageScore', () => {
  it('averages the four criteria', () => {
    expect(averageScore(scores({ technical: 5, growth: 1 }))).toBe(3);
  });

  it('rounds to one decimal place', () => {
    // 4 + 3 + 3 + 3 = 13 / 4 = 3.25
    expect(averageScore(scores({ technical: 4 }))).toBe(3.3);
  });

  it('is null with no scores at all', () => {
    expect(averageScore({})).toBeNull();
    expect(averageScore()).toBeNull();
  });

  it('ignores keys that are not criteria', () => {
    // A lean Mongoose document can carry more than the four scores; averaging
    // over Object.values() would fold them in and shift every number on the page.
    expect(averageScore({ ...scores(), _id: 'abc', bogus: 99 })).toBe(3);
  });

  it('averages only the criteria that carry a number', () => {
    expect(averageScore({ technical: 4, communication: 2 })).toBe(3);
  });
});

describe('criterionTrends', () => {
  it('always returns one entry per criterion, in display order', () => {
    expect(criterionTrends([]).map((entry) => entry.key)).toEqual([...EVALUATION_CRITERIA]);
  });

  it('reports the movement between the two newest evaluations', () => {
    const trends = criterionTrends([
      evaluation({ technical: 5, communication: 2 }),
      evaluation({ technical: 3, communication: 4 }),
    ]);

    const byKey = Object.fromEntries(trends.map((entry) => [entry.key, entry]));
    expect(byKey.technical).toEqual({ key: 'technical', latest: 5, previous: 3, delta: 2 });
    expect(byKey.communication).toEqual({
      key: 'communication',
      latest: 2,
      previous: 4,
      delta: -2,
    });
  });

  it('distinguishes "held steady" from "nothing to compare"', () => {
    const steady = criterionTrends([evaluation(), evaluation()]);
    expect(steady.every((entry) => entry.delta === 0)).toBe(true);

    const first = criterionTrends([evaluation()]);
    expect(first.every((entry) => entry.delta === null)).toBe(true);
    expect(first.every((entry) => entry.latest === 3)).toBe(true);
  });

  it('reads the newest evaluation as the first element', () => {
    // The service sorts by periodEnd descending; handing them over oldest-first
    // would invert every arrow on the page.
    const [technical] = criterionTrends([
      evaluation({ technical: 4 }),
      evaluation({ technical: 1 }),
    ]);
    expect(technical.latest).toBe(4);
    expect(technical.delta).toBe(3);
  });

  it('leaves a criterion with no earlier score at a null delta', () => {
    const trends = criterionTrends([evaluation({ technical: 5 }), { scores: { technical: 3 } }]);
    const byKey = Object.fromEntries(trends.map((entry) => [entry.key, entry]));

    expect(byKey.technical.delta).toBe(2);
    expect(byKey.growth.delta).toBeNull();
    expect(byKey.growth.latest).toBe(3);
  });
});

describe('averageDelta', () => {
  it('is the movement in the overall average', () => {
    expect(averageDelta([evaluation({ technical: 5 }), evaluation({ technical: 1 })])).toBe(1);
  });

  it('is null on a first evaluation', () => {
    expect(averageDelta([evaluation()])).toBeNull();
    expect(averageDelta([])).toBeNull();
  });

  it('is 0, not null, when the average held steady', () => {
    expect(averageDelta([evaluation(), evaluation()])).toBe(0);
  });
});
