// `narrowUserClauseToLiveIds` is the read-side guard that stops a record whose
// User was deleted straight from the database rendering as an "Unknown" row. The
// invariant worth pinning down is that it only ever NARROWS: whatever the caller
// already asked for must survive, minus the ids that no longer resolve. Widening
// it would reintroduce the ghost rows it exists to prevent.
//
// Nothing is mocked. The live ids arrive as an argument, because reading them is
// a data-access concern and lives in `repository/liveUserFilter.js` — which has
// its own test for the pairing.

const {
  narrowUserClauseToLiveIds,
  assertNarrowableUserClause,
  excludeOrphanedProfileStages,
  hasLiveUser,
} = require('./orphanedProfiles');

describe('narrowUserClauseToLiveIds', () => {
  it('constrains an unfiltered query to every live user', () => {
    expect(narrowUserClauseToLiveIds({}, ['a', 'b'])).toEqual({ user: { $in: ['a', 'b'] } });
  });

  it('keeps the rest of the filter untouched', () => {
    expect(narrowUserClauseToLiveIds({ status: 'ready', secondaryMentor: 'm1' }, ['a'])).toEqual({
      status: 'ready',
      secondaryMentor: 'm1',
      user: { $in: ['a'] },
    });
  });

  it('defaults a missing filter argument to the live-user constraint', () => {
    expect(narrowUserClauseToLiveIds(undefined, ['a'])).toEqual({ user: { $in: ['a'] } });
  });

  it('matches nothing when there are no live users at all', () => {
    expect(narrowUserClauseToLiveIds({}, [])).toEqual({ user: { $in: [] } });
    expect(narrowUserClauseToLiveIds({})).toEqual({ user: { $in: [] } });
  });

  it('intersects an existing $in rather than replacing it', () => {
    expect(narrowUserClauseToLiveIds({ user: { $in: ['b', 'gone'] } }, ['a', 'b'])).toEqual({
      user: { $in: ['b'] },
    });
  });

  it('keeps a single requested id that still resolves', () => {
    expect(narrowUserClauseToLiveIds({ user: 'a' }, ['a', 'b'])).toEqual({ user: { $in: ['a'] } });
  });

  // The whole point: asking for a deleted user matches nothing, instead of the
  // empty `user` clause that would have matched everybody.
  it('matches nothing when the only requested id is gone', () => {
    expect(narrowUserClauseToLiveIds({ user: 'gone' }, ['a', 'b'])).toEqual({ user: { $in: [] } });
  });

  it('compares ids by value, not by identity', () => {
    expect(
      narrowUserClauseToLiveIds({ user: { toString: () => 'a' } }, [{ toString: () => 'a' }])
    ).toEqual({ user: { $in: [{ toString: expect.any(Function) }] } });
  });

  it('treats an explicit null user clause as unfiltered', () => {
    expect(narrowUserClauseToLiveIds({ user: null }, ['a'])).toEqual({ user: { $in: ['a'] } });
  });

  it('refuses a clause it cannot narrow rather than shaping it wrong', () => {
    expect(() => narrowUserClauseToLiveIds({ user: { $ne: null } }, ['a'])).toThrow(
      /Cannot narrow user clause/
    );
  });
});

// An operator clause cannot be intersected with a list of ids. Left to itself it
// would stringify to "[object Object]", match no live id, and collapse to
// `{ $in: [] }` — a filter returning nothing, with nothing to say why.
describe('assertNarrowableUserClause', () => {
  it.each([
    ['no filter at all', undefined],
    ['no user clause', { status: 'ready' }],
    ['an explicit null', { user: null }],
    ['a plain id', { user: 'a' }],
    ['an ObjectId-like object', { user: { toString: () => 'a' } }],
    ['an $in list', { user: { $in: ['a'] } }],
    ['an empty $in list', { user: { $in: [] } }],
  ])('accepts %s', (_label, filter) => {
    expect(() => assertNarrowableUserClause(filter)).not.toThrow();
  });

  it.each([
    ['$ne', { $ne: null }],
    ['$nin', { $nin: ['a'] }],
    ['$exists', { $exists: true }],
    ['$in holding a non-array', { $in: 'a' }],
  ])('refuses a %s clause', (_label, clause) => {
    expect(() => assertNarrowableUserClause({ user: clause })).toThrow(/Cannot narrow user clause/);
  });
});

describe('hasLiveUser', () => {
  it('accepts a profile whose user populated', () => {
    expect(hasLiveUser({ _id: 'p1', user: { _id: 'u1' } })).toBe(true);
  });

  // The orphan case: the profile survives its user, so `populate` yields null
  // and the profile is truthy while the person is not.
  it('rejects a profile whose user populated as null', () => {
    expect(hasLiveUser({ _id: 'p1', user: null })).toBe(false);
  });

  it('rejects a profile that was never populated or is missing', () => {
    expect(hasLiveUser({ _id: 'p1' })).toBe(false);
    expect(hasLiveUser(null)).toBe(false);
    expect(hasLiveUser(undefined)).toBe(false);
  });
});

describe('excludeOrphanedProfileStages', () => {
  it('looks up the default `user` path and drops documents with no match', () => {
    expect(excludeOrphanedProfileStages()).toEqual([
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: '_userDoc' } },
      { $match: { _userDoc: { $ne: [] } } },
      { $project: { _userDoc: 0 } },
    ]);
  });

  it('accepts a dotted path for a profile spliced in under an alias', () => {
    const [lookup] = excludeOrphanedProfileStages('profile.user');

    expect(lookup.$lookup.localField).toBe('profile.user');
  });
});
