const analyticsService = require('../services/analyticsService');

exports.getUserAnalytics = async (req, res, next) => {
  try {
    const { workspaceId, days } = req.query;

    const analytics = await analyticsService.getUserAnalytics({
      userId: req.params.userId,
      workspaceId,
      days,
      requesterId: req.user._id,
    });

    res.status(200).json(analytics);
  } catch (err) {
    if (
      err.message === 'WorkspaceId is required' ||
      err.message === 'Invalid userId' ||
      err.message === 'Invalid workspaceId' ||
      err.message === 'Invalid requesterId'
    ) {
      return res.status(400).json({ message: err.message });
    }

    if (err.message === 'Workspace not found') {
      return res.status(404).json({ message: err.message });
    }

    if (
      err.message === 'Not a member of this workspace' ||
      err.message === 'User is not an active member of this workspace'
    ) {
      return res.status(403).json({ message: err.message });
    }

    next(err);
  }
};
