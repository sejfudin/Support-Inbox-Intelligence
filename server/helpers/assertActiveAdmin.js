const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { httpError } = require('./httpError');

/**
 * 400s unless `userId` names an existing, active, non-test-account admin.
 *
 * Shared by anything that lets a caller address a request or a setting at "an
 * admin" by id (`absenceRequestService#resolveRecipientAdmin`,
 * `absenceSettingsService#readPrimaryAdmin`) — never trust a picked id without
 * checking what it actually points at. `isTestAccount` is excluded for the same
 * reason `adminService.getUsers` excludes it from every admin listing: a QA
 * test account must never be reachable as something real users get notified
 * through, even via an id a client crafts directly rather than picks from the
 * (already-filtered) dropdown.
 */
const assertActiveAdmin = async (userId, message = 'Pick a valid admin.') => {
  let admin;
  try {
    admin = await User.findById(userId).select('role status isTestAccount').lean();
  } catch (err) {
    // A malformed id (not a valid ObjectId) is a bad request, not a server error.
    if (err.name === 'CastError') throw httpError(message, 400);
    throw err;
  }
  if (!admin || admin.role !== ROLES.ADMIN || admin.status !== 'active' || admin.isTestAccount) {
    throw httpError(message, 400);
  }
};

module.exports = { assertActiveAdmin };
