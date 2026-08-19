const User = require('../models/User');
const { supabase, supabaseProfileBucket } = require('../config/supabase');
const { httpError } = require('../helpers/httpError');
const { buildAvatarObjectPath, isSupportedAvatarMimeType } = require('../helpers/userAvatar');

/**
 * Setting and clearing your own profile picture.
 *
 * Every function here takes a `userId` that came from a verified token, never
 * from a URL — the same shape `changeOwnPassword` settled on. There is no
 * "set someone else's picture" path by decision, not by omission: unlike a
 * password, nobody is ever locked out of a photo, so the admin-override that
 * justifies `PATCH /auth/:id` for passwords has no equivalent here.
 */

/**
 * The bucket is public-read, so this is a synchronous string rather than an
 * `await createSignedUrl`. That is the whole reason the read side is free: an
 * avatar rides in a populated user summary, and a 40-row board with three
 * assignees each would otherwise fire 120 signing calls to paint one screen —
 * and hand back URLs that expire mid-session, defeating the browser cache on the
 * one image most likely to be re-requested. The trade is that anyone holding the
 * exact URL can fetch the image without a session; the unguessable key in
 * `buildAvatarObjectPath` is what keeps "holding the exact URL" from being
 * derivable from a user id. Recorded in `.claude/docs/security.md`.
 */
const buildAvatarPublicUrl = (avatarPath) => {
  if (!avatarPath) return null;
  const { data } = supabase.storage.from(supabaseProfileBucket).getPublicUrl(avatarPath);
  return data?.publicUrl || null;
};

const removeStoredObject = async (avatarPath) => {
  if (!avatarPath) return;

  const { error } = await supabase.storage.from(supabaseProfileBucket).remove([avatarPath]);

  // Best effort, and deliberately not thrown. An orphaned object in a bucket is
  // a cheaper problem than an account whose picture the user believes they just
  // changed but did not.
  if (error) {
    console.error('[userAvatarService] failed to remove avatar object:', error.message);
  }
};

/**
 * Upload-then-repoint-then-delete, mirroring `uploadWorkspaceLogo`. Deleting
 * first would leave an account with a broken image if the upload then failed,
 * and there is no ordering in which a *failed* replace loses the old picture.
 */
const setMyAvatar = async (userId, file) => {
  if (!file || !file.buffer) throw httpError('A profile picture file is required.', 400);

  // multer has already filtered on this. Repeated because the service is the
  // layer that owns the rule, and a caller that reaches it another way must not
  // get to write an SVG into a public bucket.
  if (!isSupportedAvatarMimeType(file.mimetype)) {
    throw httpError('Profile picture must be a JPG, PNG, or WEBP image.', 400);
  }

  const user = await User.findById(userId).select('+avatarPath');
  if (!user) throw httpError('User not found.', 404);

  const previousPath = user.avatarPath || null;
  const newPath = buildAvatarObjectPath(userId, file.mimetype);

  const { error: uploadError } = await supabase.storage
    .from(supabaseProfileBucket)
    .upload(newPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    // The file already passed this service's own type and size rules, so a refusal
    // here means the bucket disagrees with them — a deployment problem, not the
    // user's file. Surfacing Supabase's wording ("mime type image/webp is not
    // supported") would tell someone their perfectly good photo was invalid and
    // send them looking for a different one. Log the real reason, answer with one
    // they can act on.
    console.error('[userAvatarService] avatar upload rejected by storage:', uploadError.message);
    throw httpError('Could not store your profile picture. Please try again.', 502);
  }

  user.avatarPath = newPath;
  user.avatarUrl = buildAvatarPublicUrl(newPath);

  try {
    await user.save();
  } catch (saveError) {
    // The document still points at the old picture, so the object we just wrote
    // is unreferenced. Clean it up rather than leaving it behind.
    await removeStoredObject(newPath);
    throw saveError;
  }

  await removeStoredObject(previousPath);

  return { avatarUrl: user.avatarUrl };
};

const removeMyAvatar = async (userId) => {
  const user = await User.findById(userId).select('+avatarPath');
  if (!user) throw httpError('User not found.', 404);

  const previousPath = user.avatarPath || null;

  // Idempotent: removing a picture that is not there is a success, not a 404.
  // A second click, or a stale tab, should not produce an error.
  user.avatarPath = null;
  user.avatarUrl = null;
  await user.save();

  await removeStoredObject(previousPath);

  return { avatarUrl: null };
};

module.exports = {
  buildAvatarPublicUrl,
  setMyAvatar,
  removeMyAvatar,
};
