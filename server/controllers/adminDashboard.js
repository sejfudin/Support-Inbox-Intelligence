const adminDashboardService = require('../services/adminDashboardService');
const { handleControllerError: handleError } = require('../helpers/controllerError');

exports.getAdminDashboard = async (req, res, next) => {
  try {
    const data = await adminDashboardService.getAdminDashboard({
      workspaceId: req.query.workspaceId,
    });
    res.json({ success: true, message: 'Admin dashboard retrieved', data });
  } catch (error) {
    handleError(res, error, next);
  }
};
