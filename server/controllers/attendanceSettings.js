const attendanceSettingsService = require('../services/attendanceSettingsService');
const { handleControllerError: handleError } = require('../helpers/controllerError');

/**
 * The admin's attendance-request limits. Read and written by admins only — the
 * route guards say so, and nothing here re-derives that from the payload.
 *
 * Interns never call these. They receive the numbers already applied to their own
 * position, inside the `types` payload of their own request list.
 */

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await attendanceSettingsService.getSettings();
    res.json({ success: true, message: 'Request limits retrieved', data: { settings } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const settings = await attendanceSettingsService.updateSettings(req.user, req.body);
    res.json({ success: true, message: 'Request limits saved', data: { settings } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.resetSettings = async (req, res, next) => {
  try {
    const settings = await attendanceSettingsService.resetSettings(req.user);
    res.json({ success: true, message: 'Request limits reset to defaults', data: { settings } });
  } catch (error) {
    handleError(res, error, next);
  }
};
