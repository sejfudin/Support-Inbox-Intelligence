const {
  AVATAR_MIME_TO_EXT,
  MAX_AVATAR_FILE_SIZE_BYTES,
  isSupportedAvatarMimeType,
  buildAvatarObjectPath,
} = require('./userAvatar');
const { ALLOWED_LOGO_MIME_TYPES } = require('../middleware/upload');
const { userSelect, USER_DISPLAY_FIELDS } = require('../constants/userSelect');

const USER_ID = '64f000000000000000000abc';

describe('accepted file types', () => {
  it('accepts the three raster types the attachment pipeline already accepts', () => {
    expect(isSupportedAvatarMimeType('image/jpeg')).toBe(true);
    expect(isSupportedAvatarMimeType('image/png')).toBe(true);
    expect(isSupportedAvatarMimeType('image/webp')).toBe(true);
  });

  // The point of this test is the *difference* from the logo filter next door,
  // which does allow SVG. A profile picture is uploaded by any of the four roles
  // and served from a public bucket, so a script-bearing document is not
  // acceptable here even though it is acceptable for a workspace logo.
  it('refuses SVG, which the workspace-logo filter allows', () => {
    expect(ALLOWED_LOGO_MIME_TYPES.has('image/svg+xml')).toBe(true);
    expect(isSupportedAvatarMimeType('image/svg+xml')).toBe(false);
  });

  it('refuses GIF, PDF, and anything unrecognised', () => {
    expect(isSupportedAvatarMimeType('image/gif')).toBe(false);
    expect(isSupportedAvatarMimeType('application/pdf')).toBe(false);
    expect(isSupportedAvatarMimeType('text/html')).toBe(false);
    expect(isSupportedAvatarMimeType('')).toBe(false);
    expect(isSupportedAvatarMimeType(undefined)).toBe(false);
  });

  it('caps a picture at 2MB', () => {
    expect(MAX_AVATAR_FILE_SIZE_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe('buildAvatarObjectPath', () => {
  it('files an object under the owning user and gives it the right extension', () => {
    expect(buildAvatarObjectPath(USER_ID, 'image/png')).toMatch(
      new RegExp(`^avatars/${USER_ID}/\\d+-[0-9a-f]{12}\\.png$`)
    );
    expect(buildAvatarObjectPath(USER_ID, 'image/jpeg')).toMatch(/\.jpg$/);
    expect(buildAvatarObjectPath(USER_ID, 'image/webp')).toMatch(/\.webp$/);
  });

  // Replacing a picture must write a *new* key rather than overwrite one, or the
  // CDN keeps serving the previous image under a URL that never changed.
  it('never returns the same key twice for the same user and type', () => {
    const keys = new Set(
      Array.from({ length: 50 }, () => buildAvatarObjectPath(USER_ID, 'image/png'))
    );
    expect(keys.size).toBe(50);
  });

  // The public-bucket decision rests on this: the key must not be derivable from
  // the user id, which is visible in plenty of payloads.
  it('does not make the filename derivable from the user id alone', () => {
    const path = buildAvatarObjectPath(USER_ID, 'image/png');
    const filename = path.split('/').pop();
    expect(filename).not.toContain(USER_ID);
    expect(filename.replace(/\.png$/, '').split('-')[1]).toHaveLength(12);
  });

  it('refuses a type it has no extension for, rather than guessing one', () => {
    expect(() => buildAvatarObjectPath(USER_ID, 'image/svg+xml')).toThrow(
      /Unsupported profile picture type/
    );
    expect(() => buildAvatarObjectPath(USER_ID, 'image/gif')).toThrow();
    expect(AVATAR_MIME_TO_EXT['image/svg+xml']).toBeUndefined();
  });

  it('refuses to build a path with no owner', () => {
    expect(() => buildAvatarObjectPath(null, 'image/png')).toThrow(/User id is required/);
    expect(() => buildAvatarObjectPath(undefined, 'image/png')).toThrow(/User id is required/);
    expect(() => buildAvatarObjectPath('', 'image/png')).toThrow(/User id is required/);
  });
});

describe('userSelect', () => {
  // This is the assertion that keeps the feature whole. Every populated user in
  // the app runs through this projection, and an avatar that is not in the base
  // list is an avatar that silently vanishes from whichever payload forgot it.
  it('always carries the avatar, whatever else the caller asks for', () => {
    expect(userSelect()).toContain('avatarUrl');
    expect(userSelect('role')).toContain('avatarUrl');
    expect(userSelect('role', 'status', 'hub')).toContain('avatarUrl');
    expect(USER_DISPLAY_FIELDS).toContain('avatarUrl');
  });

  it('never projects the storage path, only the URL', () => {
    expect(userSelect('role', 'status', 'hub', 'workspaceId')).not.toContain('avatarPath');
  });

  it('takes extras as arguments or as one space-separated string', () => {
    expect(userSelect('role', 'hub')).toBe(userSelect('role hub'));
  });

  it('drops duplicates rather than repeating a field', () => {
    expect(userSelect('email', 'role', 'role')).toBe('fullname email avatarUrl role');
  });

  it('projects name, email and avatar with no extras', () => {
    expect(userSelect()).toBe('fullname email avatarUrl');
  });
});
