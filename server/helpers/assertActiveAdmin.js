const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { isRealUser } = require('../constants/userVisibility');
const { httpError } = require('./httpError');

/**
 * 400s unless `userId` names an existing, active admin who is a real person.
 *
 * Shared by anything that lets a caller address a request or a setting at "an
 * admin" by id (`absenceRequestService#resolveRecipientAdmin`,
 * `absenceSettingsService#readPrimaryAdmin`) — never trust a picked id without
 * checking what it actually points at. Non-people are excluded for the same
 * reason `adminService.getUsers` excludes them from every admin listing: a QA
 * test account, or the deleted-user tombstone, must never be reachable as
 * something real users get notified through, even via an id a client crafts
 * directly rather than picks from the (already-filtered) dropdown.
 */
const assertActiveAdmin = async (userId, message = 'Pick a valid admin.') => {
  let admin;
  try {
    admin = await User.findById(userId).select('role status isTestAccount isTombstone').lean();
  } catch (err) {
    // A malformed id (not a valid ObjectId) is a bad request, not a server error.
    if (err.name === 'CastError') throw httpError(message, 400);
    throw err;
  }
  if (!isRealUser(admin) || admin.role !== ROLES.ADMIN || admin.status !== 'active') {
    throw httpError(message, 400);
  }
};

module.exports = { assertActiveAdmin };
