jest.mock('../models/User', () => ({ findOne: jest.fn() }));

const User = require('../models/User');
const { isTombstoneUser, resetTombstoneCache } = require('./tombstoneUser');

const returns = (doc) => {
  User.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(doc) }) });
};

beforeEach(() => {
  jest.clearAllMocks();
  resetTombstoneCache();
});

describe('isTombstoneUser', () => {
  it('recognises the tombstone id however it is spelled', () => {
    returns({ _id: 'tombstone-1' });

    // An ObjectId and its string form have to answer the same, because callers
    // reach this with whichever one their document happened to carry.
    return expect(isTombstoneUser({ toString: () => 'tombstone-1' })).resolves.toBe(true);
  });

  it('is false for a real user', async () => {
    returns({ _id: 'tombstone-1' });
    await expect(isTombstoneUser('user-1')).resolves.toBe(false);
  });

  it('is false, without a read, when there is no id to check', async () => {
    await expect(isTombstoneUser(null)).resolves.toBe(false);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('reads once and remembers the id it found', async () => {
    returns({ _id: 'tombstone-1' });

    await isTombstoneUser('tombstone-1');
    await isTombstoneUser('user-1');

    expect(User.findOne).toHaveBeenCalledTimes(1);
  });

  it('keeps looking while there is no tombstone yet', async () => {
    // The migration that creates it can run against a live database. A remembered
    // "there isn't one" would wave the tombstone through until a restart.
    returns(null);
    await expect(isTombstoneUser('user-1')).resolves.toBe(false);
    await expect(isTombstoneUser('user-1')).resolves.toBe(false);
    expect(User.findOne).toHaveBeenCalledTimes(2);

    returns({ _id: 'tombstone-1' });
    await expect(isTombstoneUser('tombstone-1')).resolves.toBe(true);
  });
});
