// Cover for `changeOwnPassword` — the rule that an access token alone is no
// longer enough to take an account over.
//
// bcrypt is real here, not stubbed: the whole point of the function is that the
// hash comparison happens, and a mocked `compare` that returns whatever the test
// wants would assert nothing. Mongo is mocked; no DB.

process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/RefreshToken', () => ({
  create: jest.fn(async (row) => row),
  deleteMany: jest.fn(async () => ({ deletedCount: 0 })),
  deleteOne: jest.fn(async () => ({ deletedCount: 0 })),
  findOne: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { changeOwnPassword } = require('./authService');

const CURRENT = 'correct horse';
const NEW = 'battery staple';

// `User.findById(id).select('+password')` — the select is what makes the hash
// readable at all, so the stub insists on the same shape the service uses.
const mockUser = async (overrides = {}) => {
  const user = {
    _id: 'user-1',
    tokenVersion: 4,
    password: await bcrypt.hash(CURRENT, 10),
    passwordSetAt: new Date('2026-01-01T00:00:00.000Z'),
    save: jest.fn(async function () {
      return this;
    }),
    ...overrides,
  };

  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
  return user;
};

const expectUntouched = (user) => {
  expect(user.save).not.toHaveBeenCalled();
  expect(user.tokenVersion).toBe(4);
  expect(RefreshToken.deleteMany).not.toHaveBeenCalled();
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('changeOwnPassword', () => {
  it('replaces the password when the current one is right', async () => {
    const user = await mockUser();

    const result = await changeOwnPassword('user-1', {
      currentPassword: CURRENT,
      newPassword: NEW,
    });

    expect(user.save).toHaveBeenCalled();
    expect(await bcrypt.compare(NEW, user.password)).toBe(true);
    expect(result.success).toBe(true);
  });

  it('refuses the wrong current password, and writes nothing', async () => {
    const user = await mockUser();

    await expect(
      changeOwnPassword('user-1', { currentPassword: 'not it', newPassword: NEW })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringMatching(/current password is not correct/i),
    });

    expectUntouched(user);
  });

  it('gives an account with no password the same refusal as a wrong one', async () => {
    // An invited user who has never set one. Distinguishing the two cases here
    // would turn an authenticated endpoint into an oracle for account state.
    const user = await mockUser({ password: undefined });

    await expect(
      changeOwnPassword('user-1', { currentPassword: CURRENT, newPassword: NEW })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringMatching(/current password is not correct/i),
    });

    expectUntouched(user);
  });

  it('refuses a missing user with the same message', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await expect(
      changeOwnPassword('gone', { currentPassword: CURRENT, newPassword: NEW })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it.each([
    ['no current password', { currentPassword: '', newPassword: NEW }],
    ['no new password', { currentPassword: CURRENT, newPassword: '' }],
    ['nothing at all', undefined],
  ])('refuses a submission with %s', async (_label, payload) => {
    const user = await mockUser();

    await expect(changeOwnPassword('user-1', payload)).rejects.toMatchObject({
      statusCode: 400,
    });

    expectUntouched(user);
  });

  it('refuses a new password under six characters', async () => {
    const user = await mockUser();

    await expect(
      changeOwnPassword('user-1', { currentPassword: CURRENT, newPassword: 'short' })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/at least 6 characters/i),
    });

    expectUntouched(user);
  });

  it('refuses re-setting the same password', async () => {
    // It would otherwise "succeed" and sign every other session out, which is a
    // surprising amount to happen in exchange for nothing changing.
    const user = await mockUser();

    await expect(
      changeOwnPassword('user-1', { currentPassword: CURRENT, newPassword: CURRENT })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/different from your current one/i),
    });

    expectUntouched(user);
  });

  it('evicts every other session', async () => {
    const user = await mockUser();

    await changeOwnPassword('user-1', { currentPassword: CURRENT, newPassword: NEW });

    // Both halves matter: the version bump kills access tokens already issued,
    // and the delete kills the refresh tokens that could mint replacements.
    expect(user.tokenVersion).toBe(5);
    expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ user: 'user-1' });
  });

  it('hands back a token pair that survives the eviction', async () => {
    const user = await mockUser();

    const { accessToken, refreshToken } = await changeOwnPassword('user-1', {
      currentPassword: CURRENT,
      newPassword: NEW,
    });

    // Minted after the bump, so the session that changed the password keeps
    // working while everything older is now a version behind.
    expect(jwt.verify(accessToken, process.env.JWT_SECRET)).toMatchObject({
      id: 'user-1',
      tokenVersion: 5,
    });
    expect(jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)).toMatchObject({
      tokenVersion: 5,
    });
    expect(RefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: user._id, token: refreshToken })
    );
  });

  it('stamps when the password was set', async () => {
    const user = await mockUser();
    const before = user.passwordSetAt;

    await changeOwnPassword('user-1', { currentPassword: CURRENT, newPassword: NEW });

    expect(user.passwordSetAt.getTime()).toBeGreaterThan(before.getTime());
  });
});
