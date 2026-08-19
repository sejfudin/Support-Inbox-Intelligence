// Wiring-level cover for setting, replacing and removing a profile picture. The
// rules about which files are allowed and where an object lands live in
// helpers/userAvatar.test.js; what this checks is the order of operations —
// mockUpload, then repoint the user, then delete what it replaced — and that a
// failure at any step cannot leave the account pointing at nothing. Mongo and
// Supabase are mocked, so no DB and no network.

const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockGetPublicUrl = jest.fn((path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }));

jest.mock('../config/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mockUpload, remove: mockRemove, getPublicUrl: mockGetPublicUrl }),
    },
  },
  supabaseProfileBucket: 'avatars',
}));

jest.mock('../models/User', () => ({ findById: jest.fn() }));

const User = require('../models/User');
const { setMyAvatar, removeMyAvatar, buildAvatarPublicUrl } = require('./userAvatarService');

const USER_ID = '64f000000000000000000abc';

const mockUser = (overrides = {}) => {
  const user = {
    _id: USER_ID,
    avatarPath: null,
    avatarUrl: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  // The service asks for the path explicitly, because it is `select: false`.
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
  return user;
};

const file = (overrides = {}) => ({
  buffer: Buffer.from('png-bytes'),
  mimetype: 'image/png',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
  mockRemove.mockResolvedValue({ error: null });
  console.error = jest.fn();
});

describe('setMyAvatar', () => {
  it('uploads the object, then points the account at it', async () => {
    const user = mockUser();

    const result = await setMyAvatar(USER_ID, file());

    expect(mockUpload).toHaveBeenCalledTimes(1);
    const [path, buffer, options] = mockUpload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^avatars/${USER_ID}/\\d+-[0-9a-f]{12}\\.png$`));
    expect(buffer).toEqual(Buffer.from('png-bytes'));
    // A fresh key every time, so upsert would be meaningless and overwriting is
    // never what is wanted.
    expect(options).toMatchObject({ contentType: 'image/png', upsert: false });

    expect(user.avatarPath).toBe(path);
    expect(user.avatarUrl).toBe(`https://cdn.test/${path}`);
    expect(user.save).toHaveBeenCalled();
    expect(result).toEqual({ avatarUrl: `https://cdn.test/${path}` });
  });

  it('deletes the picture it replaced, and only after the new one is saved', async () => {
    const calls = [];
    const user = mockUser({ avatarPath: 'avatars/old/1-aaaaaaaaaaaa.png' });
    mockUpload.mockImplementation(async () => (calls.push('mockUpload'), { error: null }));
    user.save.mockImplementation(async () => calls.push('save'));
    mockRemove.mockImplementation(async () => (calls.push('mockRemove'), { error: null }));

    await setMyAvatar(USER_ID, file());

    expect(calls).toEqual(['mockUpload', 'save', 'mockRemove']);
    expect(mockRemove).toHaveBeenCalledWith(['avatars/old/1-aaaaaaaaaaaa.png']);
  });

  it('has nothing to delete for a first-ever picture', async () => {
    mockUser({ avatarPath: null });
    await setMyAvatar(USER_ID, file());
    expect(mockRemove).not.toHaveBeenCalled();
  });

  // An orphaned object in a bucket is a cheaper problem than an account whose
  // picture the user believes they just changed but did not.
  it('still succeeds when the old object cannot be deleted', async () => {
    const user = mockUser({ avatarPath: 'avatars/old/1-aaaaaaaaaaaa.png' });
    mockRemove.mockResolvedValue({ error: { message: 'gone' } });

    await expect(setMyAvatar(USER_ID, file())).resolves.toMatchObject({
      avatarUrl: expect.stringContaining('https://cdn.test/'),
    });
    expect(user.save).toHaveBeenCalled();
  });

  it('leaves the old picture in place when the mockUpload fails', async () => {
    const user = mockUser({
      avatarPath: 'avatars/old/1-aaaaaaaaaaaa.png',
      avatarUrl: 'https://cdn.test/avatars/old/1-aaaaaaaaaaaa.png',
    });
    mockUpload.mockResolvedValue({ error: { message: 'storage is down' } });

    // The user's file was valid by our rules, so the message must not blame it;
    // the real reason goes to the log.
    await expect(setMyAvatar(USER_ID, file())).rejects.toMatchObject({
      message: 'Could not store your profile picture. Please try again.',
      statusCode: 502,
    });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('rejected by storage'),
      'storage is down'
    );

    expect(user.avatarPath).toBe('avatars/old/1-aaaaaaaaaaaa.png');
    expect(user.save).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  // The object was written but nothing references it, so it has to go — otherwise
  // every failed save leaks a file.
  it('cleans up the object it just wrote when the save fails', async () => {
    const user = mockUser();
    user.save.mockRejectedValue(new Error('validation failed'));

    await expect(setMyAvatar(USER_ID, file())).rejects.toThrow('validation failed');

    const [writtenPath] = mockUpload.mock.calls[0];
    expect(mockRemove).toHaveBeenCalledWith([writtenPath]);
  });

  it('refuses a request with no file', async () => {
    mockUser();
    await expect(setMyAvatar(USER_ID, null)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  // multer already filtered this. Repeated in the service because the service owns
  // the rule, and a caller reaching it another way must not get to write a
  // script-bearing document into a public bucket.
  it('refuses an SVG even though multer would have caught it first', async () => {
    mockUser();
    await expect(setMyAvatar(USER_ID, file({ mimetype: 'image/svg+xml' }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('404s for an account that does not exist', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await expect(setMyAvatar(USER_ID, file())).rejects.toMatchObject({ statusCode: 404 });
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('removeMyAvatar', () => {
  it('clears both fields and deletes the object', async () => {
    const user = mockUser({
      avatarPath: 'avatars/x/1-aaaaaaaaaaaa.png',
      avatarUrl: 'https://cdn.test/avatars/x/1-aaaaaaaaaaaa.png',
    });

    const result = await removeMyAvatar(USER_ID);

    expect(user.avatarPath).toBeNull();
    expect(user.avatarUrl).toBeNull();
    expect(user.save).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalledWith(['avatars/x/1-aaaaaaaaaaaa.png']);
    expect(result).toEqual({ avatarUrl: null });
  });

  // A second click, or a stale tab, should not produce an error.
  it('is idempotent when there is no picture to mockRemove', async () => {
    const user = mockUser({ avatarPath: null, avatarUrl: null });

    await expect(removeMyAvatar(USER_ID)).resolves.toEqual({ avatarUrl: null });
    expect(user.save).toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('404s for an account that does not exist', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await expect(removeMyAvatar(USER_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('buildAvatarPublicUrl', () => {
  it('is null for an account with no stored path', () => {
    expect(buildAvatarPublicUrl(null)).toBeNull();
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });

  it('is a plain synchronous URL, never a signed one', () => {
    expect(buildAvatarPublicUrl('avatars/x/y.png')).toBe('https://cdn.test/avatars/x/y.png');
  });
});
