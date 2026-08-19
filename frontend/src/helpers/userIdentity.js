/**
 * One way to get an id out of a user, wherever that user came from.
 *
 * The same value arrives in three shapes across this app, which is why every call
 * site used to spell the fallback out by hand:
 *
 * - `_id` — a Mongo document, straight from an API payload.
 * - `id` — the auth payloads (`/auth/me`) and anything already normalized.
 * - a plain string — a Mongoose ref that was never populated, so the field *is* the
 *   id (`workspace.owner`, `intern.primaryMentor`).
 *
 * Always `null` when there is nothing to resolve, never `undefined`: a comparison
 * against a missing id should read the same whether the user is absent or the id is.
 */
export const resolveUserId = (user) => {
  if (!user) return null;
  if (typeof user === 'string') return user;
  return user._id || user.id || null;
};

/**
 * The display name, wherever the user came from.
 *
 * `fullname` is the Mongo field; `fullName` is what the auth payloads spell it
 * as. Falling back to the email means a user record that somehow has no name
 * still renders as something a person can recognise, rather than as `?`.
 */
export const resolveUserName = (user) => {
  if (!user) return '';
  if (typeof user === 'string') return user;
  return user.fullname || user.fullName || user.email || '';
};

/**
 * One or two initials from a name.
 *
 * "DP" for Dario Perić — the first letter of the first and last word, so a
 * three-part name gives two letters rather than three, and a single-word name
 * gives its first two characters rather than one lonely letter.
 *
 * This replaced three separate implementations that disagreed:
 * `helpers/getInitials.js` took the first letter of *every* word capped at two,
 * so "Ana Maria Perić" read as `AM` there and `AP` in `helpers/initials.js` and
 * `helpers/staffingRequests.js`. The same colleague had different initials
 * depending on which screen you were looking at.
 */
export const getInitials = (name = '', fallback = '?') => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};

/** The initials for a user object, whatever shape it arrived in. */
export const resolveUserInitials = (user, fallback = '?') =>
  getInitials(resolveUserName(user), fallback);

/**
 * The profile picture, or `null` when there isn't one.
 *
 * Always a URL and never a storage path — the server derives the URL at write
 * time and projects only that (`server/constants/userSelect.js`), so there is
 * nothing for the client to build. `null` is the signal to fall back to initials.
 */
export const resolveUserAvatarUrl = (user) => {
  if (!user || typeof user === 'string') return null;
  return user.avatarUrl || null;
};
