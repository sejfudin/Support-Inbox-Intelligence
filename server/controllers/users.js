const userPreferenceService = require('../services/userPreferenceService');

/**
 * The signed-in user's own UI preferences. Scoped to `req.user` and nothing
 * else — there is no id in the path, so one account can never read or write
 * another's.
 */

const handleError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }

  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors)
      .map((err) => err.message)
      .join(', ');
    return res.status(400).json({ success: false, message });
  }

  next(error);
};

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
