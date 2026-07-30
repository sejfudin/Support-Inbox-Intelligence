const Workspace = require('../models/Workspace');
const { ROLES } = require('../constants/roles');

// Default resolution covers routes where the workspace id is explicit:
// `:workspaceId` / `:id` route params (e.g. /api/workspaces/:id), body/query,
// or the caller's active workspace. Routes whose `:id` is NOT a workspace id
// (e.g. /api/categories/:id) MUST pass a custom resolver via
// `workspaceManagerGuard` — otherwise the resource id would be misread as a
// workspace id and every non-platform-admin would 404.
const defaultResolveWorkspaceId = (req) =>
  req.params.workspaceId ||
  req.params.id ||
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

// `resolveWorkspaceId(req)` may be async and may throw an error carrying a
// `statusCode` (e.g. 404 when the resource anchoring the workspace is gone).
// On success the authorized workspace id is stashed on `req.managedWorkspaceId`
// so downstream controllers operate on exactly the workspace that was
// authorized — never a differently-resolved one. Platform admins bypass the
// membership check by design; their controllers handle admin overrides.
const workspaceManagerGuard =
  (resolveWorkspaceId = defaultResolveWorkspaceId) =>
  async (req, res, next) => {
    try {
      if (req.user?.role === ROLES.ADMIN) {
        return next();
      }

      const workspaceId = await resolveWorkspaceId(req);
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

      req.managedWorkspaceId = workspaceId.toString();
      return next();
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return next(error);
    }
  };

exports.requireWorkspaceManager = workspaceManagerGuard();
exports.workspaceManagerGuard = workspaceManagerGuard;
