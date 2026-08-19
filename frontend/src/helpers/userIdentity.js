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
