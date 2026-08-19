const crypto = require('crypto');

/**
 * The pure half of profile pictures: which files are allowed, and where an
 * object goes in the bucket.
 *
 * Deliberately free of both Mongoose and the Supabase client, for the same
 * reason `absenceRequestRules.js` is — these are the rules worth pinning in a
 * unit test, and a test should not need a database or a storage account to assert
 * that an SVG is refused.
 */

/**
 * No SVG, unlike `ALLOWED_LOGO_MIME_TYPES` next door in `middleware/upload.js`.
 * An SVG is a script-bearing document, and the two things that make it tolerable
 * for a workspace logo are both absent here: a logo is set by an admin
 * configuring a workspace, where a profile picture is uploaded by any of the four
 * roles, and these objects are served from a public bucket. This is the same set
 * `ALLOWED_MIME_TYPES` already uses for ticket attachments.
 */
const AVATAR_MIME_TO_EXT = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});

const ALLOWED_AVATAR_MIME_TYPES = Object.freeze(new Set(Object.keys(AVATAR_MIME_TO_EXT)));

const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const isSupportedAvatarMimeType = (mimeType) => ALLOWED_AVATAR_MIME_TYPES.has(mimeType);

/**
 * `avatars/<userId>/<timestamp>-<random>.<ext>`.
 *
 * Per-user folder so an account's objects can be found and removed together, and
 * the timestamp-plus-six-random-bytes filename from `buildWorkspaceLogoPath` for
 * two reasons: replacing a picture writes a new key rather than overwriting one,
 * which keeps the CDN from serving the old image under a URL that has not
 * changed, and the key is not guessable from the user id alone — which is what
 * carries the public-bucket decision (see `.claude/docs/security.md`).
 */
const buildAvatarObjectPath = (userId, mimeType) => {
  const ext = AVATAR_MIME_TO_EXT[mimeType];
  if (!ext) throw new Error('Unsupported profile picture type.');
  if (!userId) throw new Error('User id is required to build an avatar path.');

  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  return `avatars/${userId}/${timestamp}-${random}.${ext}`;
};

module.exports = {
  AVATAR_MIME_TO_EXT,
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_FILE_SIZE_BYTES,
  isSupportedAvatarMimeType,
  buildAvatarObjectPath,
};
