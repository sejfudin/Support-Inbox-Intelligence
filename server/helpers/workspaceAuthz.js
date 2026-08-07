// Shared workspace-scoping checks. A user can belong to multiple workspaces,
// so membership must be checked against a workspace's `members` list rather
// than a user's single active `workspaceId`.

const Workspace = require('../models/Workspace');
const { ROLES } = require('../constants/roles');

const ANY_WORKSPACE_ROLES = new Set([ROLES.ADMIN, ROLES.MENTOR]);

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

// Resolves the "ambient" workspace a request acts on — the caller's active
// workspace, or an explicit admin-only override.
//
// `User.workspaceId` is only a pointer to the workspace the user last switched
// to; it is NOT proof of membership. It can outlive the membership that made it
// valid: `switchWorkspace` sets it for admins without creating a member entry,
// and a role downgrade (admin/mentor → intern) removes the
// `canAccessAnyWorkspace` bypass while leaving the pointer behind. So for roles
// without that bypass the pointer is verified against the workspace's `members`
// list here, and resolves to `null` when it no longer holds.
//
// Callers must treat `null` as "no workspace" (empty result / 400), never as
// "unscoped" — a query built with an undefined workspace filter would match
// every workspace.
const resolveActiveWorkspaceId = async ({ user, override } = {}) => {
  if (user?.role === ROLES.ADMIN && override) return override;

  const candidate = user?.workspaceId;
  if (!candidate) return null;

  // Admins and mentors act across every workspace, so their pointer needs no
  // membership backing.
  if (canAccessAnyWorkspace(user?.role)) return candidate;

  const workspace = await Workspace.findById(candidate).select('members');
  return isActiveWorkspaceMember(workspace, user?._id) ? candidate : null;
};

module.exports = {
  canAccessAnyWorkspace,
  isActiveWorkspaceMember,
  hasWorkspaceAccess,
  assertWorkspaceAccess,
  resolveActiveWorkspaceId,
};
