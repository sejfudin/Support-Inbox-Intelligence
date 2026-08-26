const { strategyFor, buildPlan, totalRefs } = require('./repointPlan');

const finding = (overrides) => ({
  modelName: 'Ticket',
  refPath: 'creator',
  isArray: false,
  inDocArray: false,
  isRequired: false,
  nestedDocArray: false,
  docArrayPath: null,
  leafPath: null,
  dangling: [{ docId: 'd1', userId: 'u1' }],
  ...overrides,
});

describe('strategyFor', () => {
  it('writes a scalar with $set — including a required one', () => {
    // The whole reason this migration exists. `$unset` on a required field leaves
    // a document the app can never save again; `$set` to a real user does not.
    expect(strategyFor(finding({ isRequired: true }))).toBe('set');
  });

  it('swaps inside a plain array of ids', () => {
    expect(strategyFor(finding({ isArray: true }))).toBe('swap-in-array');
  });

  it('writes a ref inside a document array in place', () => {
    expect(
      strategyFor(finding({ inDocArray: true, docArrayPath: 'members', leafPath: 'user' }))
    ).toBe('positional');
  });

  it('refuses two nested document arrays rather than writing the wrong element', () => {
    expect(strategyFor(finding({ inDocArray: true, nestedDocArray: true }))).toBe('refuse-nested');
  });
});

describe('buildPlan', () => {
  it('defers refs whose whole subject is gone to the cleanup script', () => {
    const plan = buildPlan([
      finding({ modelName: 'InternProfile', refPath: 'user' }),
      finding({ modelName: 'Notification', refPath: 'recipient' }),
      finding({ modelName: 'Ticket', refPath: 'creator' }),
    ]);

    expect(plan.deferred.map((row) => `${row.modelName}.${row.refPath}`)).toEqual([
      'InternProfile.user',
      'Notification.recipient',
    ]);
    expect(plan.repointable).toHaveLength(1);
    expect(plan.refused).toHaveLength(0);
  });

  it('separates what it declines from what it will write', () => {
    const plan = buildPlan([
      finding({ modelName: 'Workspace', refPath: 'members.user', inDocArray: true }),
      finding({ modelName: 'Deep', refPath: 'a.b.c', inDocArray: true, nestedDocArray: true }),
    ]);

    expect(plan.repointable.map((row) => row.strategy)).toEqual(['positional']);
    expect(plan.refused.map((row) => row.strategy)).toEqual(['refuse-nested']);
  });

  it('tags each repointable finding with the strategy the writer will use', () => {
    const plan = buildPlan([finding({ isArray: true })]);
    expect(plan.repointable[0].strategy).toBe('swap-in-array');
  });
});

describe('totalRefs', () => {
  it('counts individual refs, not findings', () => {
    const rows = [
      finding({
        dangling: [
          { docId: 'd1', userId: 'u1' },
          { docId: 'd2', userId: 'u1' },
        ],
      }),
      finding({ dangling: [{ docId: 'd3', userId: 'u2' }] }),
    ];

    expect(totalRefs(rows)).toBe(3);
  });
});
