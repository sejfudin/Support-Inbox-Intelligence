const aiSummaryService = require('../services/aiSummaryService');
const { resolveActiveWorkspaceId } = require('../helpers/workspaceAuthz');

// Unlike the other ambient-workspace controllers, an explicit workspaceId is
// honored here for every role: `aiSummaryService.ensureWorkspaceAccess` requires
// the requester to be an active member of whatever workspace is asked for
// (admins excepted), so the override can't reach a workspace they don't belong
// to — and a user who belongs to two workspaces can legitimately ask about the
// one that isn't their current pointer. Only the implicit fallback needs
// verifying, since that is the part that goes stale.
function getWorkspaceId(req) {
  const explicit = req.query.workspaceId || req.body?.workspaceId;
  if (explicit) return explicit;
  return resolveActiveWorkspaceId({ user: req.user });
}

function handleSummaryError(error, res, next) {
  if (
    error.message === 'Invalid userId' ||
    error.message === 'Invalid workspaceId' ||
    error.message === 'Invalid requesterId'
  ) {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (
    error.message === 'Workspace not found' ||
    error.message === 'No tickets found for this user in the workspace.' ||
    error.message === 'No completed tickets found for this user in the workspace.'
  ) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 404;
    return res.status(statusCode).json({ success: false, message: error.message });
  }

  if (
    error.message === 'Not a member of this workspace' ||
    error.message === 'User is not an active member of this workspace'
  ) {
    return res.status(403).json({ success: false, message: error.message });
  }

  if (Number.isInteger(error?.statusCode)) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message || 'AI summary generation is currently unavailable.',
    });
  }

  return next(error);
}

const getLatestUserSummary = async (req, res, next) => {
  try {
    const summary = await aiSummaryService.getLatestUserSummary({
      userId: req.params.userId,
      workspaceId: await getWorkspaceId(req),
      requesterId: req.user._id,
      requesterRole: req.user.role,
    });

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return handleSummaryError(error, res, next);
  }
};

const generateUserSummary = async (req, res, next) => {
  try {
    const summary = await aiSummaryService.generateUserSummary({
      userId: req.params.userId,
      workspaceId: await getWorkspaceId(req),
      requesterId: req.user._id,
      requesterRole: req.user.role,
    });

    return res.status(201).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return handleSummaryError(error, res, next);
  }
};

module.exports = {
  getLatestUserSummary,
  generateUserSummary,
};
