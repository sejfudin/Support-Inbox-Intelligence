const adminDashboardService = require('../services/adminDashboardService');

const handleError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  next(error);
};

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
