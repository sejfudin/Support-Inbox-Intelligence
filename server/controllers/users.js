const userPreferenceService = require('../services/userPreferenceService');
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
