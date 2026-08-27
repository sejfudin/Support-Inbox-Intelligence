const User = require('../models/User');
const { httpError } = require('../helpers/httpError');

/**
 * The what's-new tour's seen-state, which lives on the account rather than in
 * one browser's `localStorage`.
 *
 * It used to be `localStorage['whatsNewTour:<userId>']` and nothing else, which
 * meant reading the tour in Chrome and meeting it again in Safari, on a phone,
 * and on every fresh machine. The client still writes that key — as an
 * immediate, offline-safe backstop — but this is the source of truth.
 *
 * One value, one write. There is no read function here because there is nothing
 * to read: `getMe` already spreads the user document, so the client has
 * `whatsNewSeenVersion` in hand before the tour can decide anything.
 */

/**
 * A defensive bound, not a schema. The server deliberately does **not** hold a
 * copy of `TOUR_VERSION` to check against: shipping a release through the tour
 * is documented as two steps (edit the steps, bump the version), and a mirrored
 * server constant would quietly make it three — with a forgotten bump rejecting
 * every save and the tour reopening forever. The only thing worth refusing here
 * is a value that is not a plausible version string at all.
 */
const MAX_VERSION_LENGTH = 100;

/**
 * Records that this account has finished (or escaped out of) the given tour
 * version. Last write wins, and re-sending the same version is a no-op that
 * still answers 200 — the client fires this on every finish, including a replay
 * of a tour already marked seen.
 */
const markWhatsNewSeen = async (userId, version) => {
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw httpError('A tour version is required', 400);
  }

  const trimmed = version.trim();
  if (trimmed.length > MAX_VERSION_LENGTH) {
    throw httpError('Tour version is not a valid version string', 400);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { whatsNewSeenVersion: trimmed } },
    { new: true, runValidators: true, select: 'whatsNewSeenVersion' }
  ).lean();

  if (!user) throw httpError('User not found', 404);

  return { whatsNewSeenVersion: user.whatsNewSeenVersion };
};

module.exports = { markWhatsNewSeen, MAX_VERSION_LENGTH };
