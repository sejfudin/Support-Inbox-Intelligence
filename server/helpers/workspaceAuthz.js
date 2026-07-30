// Shared workspace-scoping checks. A user can belong to multiple workspaces,
// so membership must be checked against a workspace's `members` list rather
// than a user's single active `workspaceId`.

const Workspace = require('../models/Workspace');

const ANY_WORKSPACE_ROLES = new Set(['admin', 'mentor']);

// Admins and mentors are allowed to act across every workspace; everyone else
// is restricted to workspaces they actively belong to.
const canAccessAnyWorkspace = (role) => ANY_WORKSPACE_ROLES.has(role);

// `workspace` may be null/undefined (e.g. not found) or a Workspace doc/plain
// object with a `members` array of `{ user, status }`.
const isActiveWorkspaceMember = (workspace, userId) =>
  Boolean(
    workspace?.members?.some(
      (member) => member.user && member.user.equals(userId) && member.status === 'active'
    )
  );

// Combines both checks: true if the role bypasses workspace scoping, or the
// user is an active member of the given workspace.
const hasWorkspaceAccess = ({ role, workspace, userId }) =>
  canAccessAnyWorkspace(role) || isActiveWorkspaceMember(workspace, userId);

// Fetches the workspace and asserts the caller may access it, given a resource
// that belongs to `workspaceId` (a ticket, its comments, its history, its
// attachments, ...). Admins/mentors act across every workspace; everyone else
// must be an active member. Throws a 404 (not a 403) on failure so a caller
// can't distinguish "forbidden" from "doesn't exist" and probe resource IDs.
const assertWorkspaceAccess = async (workspaceId, user, notFoundMessage = 'Not found') => {
  if (canAccessAnyWorkspace(user?.role)) return;

  const workspace = await Workspace.findById(workspaceId).select('members');
  if (!isActiveWorkspaceMember(workspace, user?._id)) {
    const err = new Error(notFoundMessage);
    err.statusCode = 404;
    throw err;
  }
};

module.exports = {
  canAccessAnyWorkspace,
  isActiveWorkspaceMember,
  hasWorkspaceAccess,
  assertWorkspaceAccess,
};
