// The seam between the users read and the pure filter shaping. The shaping
// itself is covered in `helpers/orphanedProfiles.test.js`; what matters here is
// the pairing — that the ids handed to the shaper are the ones just read, and
// that an unusable clause fails before the read is paid for.
//
// Mongo is mocked: this module exists to be the only place that touches it.

jest.mock('../models/User', () => ({ find: jest.fn() }));

const User = require('../models/User');
const { findLiveUserIds, restrictProfileFilterToLiveUsers } = require('./liveUserFilter');

const liveUsers = (...ids) => {
  User.find.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(ids.map((_id) => ({ _id }))) }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('findLiveUserIds', () => {
  it('returns just the ids', async () => {
    liveUsers('a', 'b');

    expect(await findLiveUserIds()).toEqual(['a', 'b']);
  });

  it('returns an empty list when no user is left', async () => {
    liveUsers();

    expect(await findLiveUserIds()).toEqual([]);
  });
});

describe('restrictProfileFilterToLiveUsers', () => {
  it('narrows the filter to the ids it just read', async () => {
    liveUsers('a', 'b');

    expect(await restrictProfileFilterToLiveUsers({ status: 'ready' })).toEqual({
      status: 'ready',
      user: { $in: ['a', 'b'] },
    });
  });

  it('intersects a requested id with the live ids', async () => {
    liveUsers('a', 'b');

    expect(await restrictProfileFilterToLiveUsers({ user: 'gone' })).toEqual({
      user: { $in: [] },
    });
  });

  // A filter this cannot narrow is a programming error, and there is no reason to
  // scan the whole users collection to find that out.
  it('refuses an unusable clause before reading the users collection', async () => {
    liveUsers('a');

    await expect(restrictProfileFilterToLiveUsers({ user: { $ne: null } })).rejects.toThrow(
      /Cannot narrow user clause/
    );
    expect(User.find).not.toHaveBeenCalled();
  });
});
