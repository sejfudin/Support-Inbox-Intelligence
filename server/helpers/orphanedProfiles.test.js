// `restrictProfileFilterToLiveUsers` is the read-side guard that stops a record
// whose User was deleted straight from the database rendering as an "Unknown"
// row. The invariant worth pinning down is that it only ever NARROWS: whatever
// the caller already asked for must survive, minus the ids that no longer
// resolve. Widening it would reintroduce the ghost rows it exists to prevent.
//
// Mongo is mocked — this is a filter-shaping function, not a query.

jest.mock('../models/User', () => ({ find: jest.fn() }));

const User = require('../models/User');
const {
  restrictProfileFilterToLiveUsers,
  excludeOrphanedProfileStages,
  hasLiveUser,
} = require('./orphanedProfiles');

const liveUsers = (...ids) => {
  User.find.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(ids.map((_id) => ({ _id }))) }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('restrictProfileFilterToLiveUsers', () => {
  it('constrains an unfiltered query to every live user', async () => {
    liveUsers('a', 'b');

    expect(await restrictProfileFilterToLiveUsers({})).toEqual({ user: { $in: ['a', 'b'] } });
  });

  it('keeps the rest of the filter untouched', async () => {
    liveUsers('a');

    expect(
      await restrictProfileFilterToLiveUsers({ status: 'ready', secondaryMentor: 'm1' })
    ).toEqual({ status: 'ready', secondaryMentor: 'm1', user: { $in: ['a'] } });
  });

  it('defaults a missing filter argument to the live-user constraint', async () => {
    liveUsers('a');

    expect(await restrictProfileFilterToLiveUsers()).toEqual({ user: { $in: ['a'] } });
  });

  it('intersects an existing $in rather than replacing it', async () => {
    liveUsers('a', 'b');

    expect(await restrictProfileFilterToLiveUsers({ user: { $in: ['b', 'gone'] } })).toEqual({
      user: { $in: ['b'] },
    });
  });

  it('keeps a single requested id that still resolves', async () => {
    liveUsers('a', 'b');

    expect(await restrictProfileFilterToLiveUsers({ user: 'a' })).toEqual({ user: { $in: ['a'] } });
  });

  // The whole point: asking for a deleted user matches nothing, instead of the
  // empty `user` clause that would have matched everybody.
  it('matches nothing when the only requested id is gone', async () => {
    liveUsers('a', 'b');

    expect(await restrictProfileFilterToLiveUsers({ user: 'gone' })).toEqual({ user: { $in: [] } });
  });

  it('compares ids by value, not by identity', async () => {
    const id = { toString: () => 'a' };
    liveUsers(id);

    expect(await restrictProfileFilterToLiveUsers({ user: { toString: () => 'a' } })).toEqual({
      user: { $in: [{ toString: expect.any(Function) }] },
    });
  });

  it('treats an explicit null user clause as unfiltered', async () => {
    liveUsers('a');

    expect(await restrictProfileFilterToLiveUsers({ user: null })).toEqual({
      user: { $in: ['a'] },
    });
  });

  // An operator clause cannot be intersected with a list of ids. Left to itself
  // it would stringify to "[object Object]", match no live id, and collapse to
  // `{ $in: [] }` — a filter returning nothing, with nothing to say why.
  it.each([
    ['$ne', { $ne: null }],
    ['$nin', { $nin: ['a'] }],
    ['$exists', { $exists: true }],
  ])('refuses a %s user clause instead of silently matching nothing', async (_label, clause) => {
    liveUsers('a', 'b');

    await expect(restrictProfileFilterToLiveUsers({ user: clause })).rejects.toThrow(
      /cannot narrow user clause/
    );
  });

  it('refuses before reading the users collection', async () => {
    liveUsers('a');

    await expect(restrictProfileFilterToLiveUsers({ user: { $ne: null } })).rejects.toThrow();
    expect(User.find).not.toHaveBeenCalled();
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
