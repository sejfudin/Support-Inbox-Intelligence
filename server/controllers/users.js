const userPreferenceService = require('../services/userPreferenceService');
const onboardingTourService = require('../services/onboardingTourService');
const { handleControllerError: handleError } = require('../helpers/controllerError');

/**
 * The signed-in user's own UI preferences. Scoped to `req.user` and nothing
 * else — there is no id in the path, so one account can never read or write
 * another's.
 */

exports.getMyPreferences = async (req, res, next) => {
  try {
    const result = await userPreferenceService.getPreferences(req.user._id);
    res.json({ success: true, message: 'Preferences retrieved', data: result });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.updateMyPreferences = async (req, res, next) => {
  try {
    const result = await userPreferenceService.updatePreferences(req.user._id, req.body);
    res.json({ success: true, message: 'Preferences saved', data: result });
  } catch (error) {
    handleError(res, error, next);
  }
};

/**
 * Marks the what's-new tour seen for the caller. Same rule as the preferences
 * handlers above: the subject is `req.user`, never a path parameter, so one
 * account can never mark another's tour read.
 */
exports.markWhatsNewSeen = async (req, res, next) => {
  try {
    const result = await onboardingTourService.markWhatsNewSeen(req.user._id, req.body?.version);
    res.json({ success: true, message: 'Tour marked as seen', data: result });
  } catch (error) {
    handleError(res, error, next);
  }
};
