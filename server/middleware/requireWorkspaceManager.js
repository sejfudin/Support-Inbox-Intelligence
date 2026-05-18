const Workspace = require('../models/Workspace');

const resolveWorkspaceId = (req) =>
  req.params.id ||
  req.params.workspaceId ||
  req.body?.workspaceId ||
  req.query?.workspaceId ||
  req.user?.workspaceId;

const isWorkspaceAdminMember = (workspace, userId) => {
  const normalizedUserId = userId.toString();
  const ownerId = workspace.owner?.toString();

  if (ownerId === normalizedUserId) {
    return true;
  }

  return workspace.members?.some(
    (member) =>
      member.user?.toString() === normalizedUserId &&
      member.status === 'active' &&
      member.role === 'admin'
  );
};

exports.requireWorkspaceManager = async (req, res, next) => {
  try {
    if (req.user?.role === 'admin') {
      return next();
    }

    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) {
      return res.status(403).json({ message: 'Forbidden: No workspace context' });
    }

    const workspace = await Workspace.findById(workspaceId).select('owner members').lean();
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!isWorkspaceAdminMember(workspace, req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
