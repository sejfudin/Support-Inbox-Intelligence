// Shared workspace-scoping checks. A user can belong to multiple workspaces,
// so membership must be checked against a workspace's `members` list rather
// than a user's single active `workspaceId`.

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

module.exports = {
  canAccessAnyWorkspace,
  isActiveWorkspaceMember,
  hasWorkspaceAccess,
};
