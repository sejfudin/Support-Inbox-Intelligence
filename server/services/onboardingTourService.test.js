// The validation and the write shape of the tour's seen-state. `User` is mocked
// away, so this file needs no database — same arrangement as
// `userPreferenceService.test.js` beside it.

jest.mock('../models/User', () => ({
  findByIdAndUpdate: jest.fn(),
}));

const User = require('../models/User');
const { markWhatsNewSeen, MAX_VERSION_LENGTH } = require('./onboardingTourService');

const USER_ID = '507f1f77bcf86cd799439011';

/** `findByIdAndUpdate(...).lean()` — the chain the service actually calls. */
const mockUpdateResolving = (value) => {
  User.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(value) });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('markWhatsNewSeen', () => {
  it('stores the version against the account and answers with what was stored', async () => {
    mockUpdateResolving({ whatsNewSeenVersion: '2026-08-profile-pictures' });

    const result = await markWhatsNewSeen(USER_ID, '2026-08-profile-pictures');

    expect(result).toEqual({ whatsNewSeenVersion: '2026-08-profile-pictures' });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      { $set: { whatsNewSeenVersion: '2026-08-profile-pictures' } },
      expect.objectContaining({ new: true })
    );
  });

  it('trims the version, so whitespace cannot produce a value that never matches', async () => {
    mockUpdateResolving({ whatsNewSeenVersion: '2026-08-profile-pictures' });

    await markWhatsNewSeen(USER_ID, '  2026-08-profile-pictures\n');

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      { $set: { whatsNewSeenVersion: '2026-08-profile-pictures' } },
      expect.anything()
    );
  });

  it.each([
    ['nothing at all', undefined],
    ['null', null],
    ['an empty string', ''],
    ['only whitespace', '   '],
    ['a number', 2026],
    ['an object', { version: 'x' }],
  ])('refuses %s rather than storing it', async (_label, version) => {
    await expect(markWhatsNewSeen(USER_ID, version)).rejects.toMatchObject({ statusCode: 400 });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses a version longer than the bound, so the field cannot be used as storage', async () => {
    await expect(
      markWhatsNewSeen(USER_ID, 'x'.repeat(MAX_VERSION_LENGTH + 1))
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('accepts a version we have never heard of — the server holds no copy of TOUR_VERSION', async () => {
    // Deliberate: mirroring the constant here would make shipping a release a
    // three-step job, and a forgotten bump would reject every save.
    mockUpdateResolving({ whatsNewSeenVersion: '2099-01-something-later' });

    await expect(markWhatsNewSeen(USER_ID, '2099-01-something-later')).resolves.toEqual({
      whatsNewSeenVersion: '2099-01-something-later',
    });
  });

  it('is a 404 when the account is gone', async () => {
    mockUpdateResolving(null);

    await expect(markWhatsNewSeen(USER_ID, '2026-08-profile-pictures')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
