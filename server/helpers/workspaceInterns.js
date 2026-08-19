const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { ROLES } = require('../constants/roles');
const { userSelect } = require('../constants/userSelect');

/**
 * The interns who count as "in" a workspace.
 *
 * There is no `workspace` field on InternProfile — membership lives on
 * `Workspace.members`, so every workspace-scoped intern list has to go through
 * it. `User.workspaceId` is only the member's *currently active* workspace and
 * is NOT a membership record: scoping on it would silently drop interns who
 * belong to this workspace but are currently switched into another one.
 */
const getActiveWorkspaceInterns = async (workspaceId) => {
  const memberUserIds = await getActiveMemberUserIds(workspaceId);
  if (memberUserIds.length === 0) return [];

  return User.find({
    _id: { $in: memberUserIds },
    role: ROLES.INTERN,
    active: true,
    status: 'active',
  })
    .select(userSelect())
    .lean();
};

/**
 * Every active member's user id, regardless of role — the membership lookup
 * `getActiveWorkspaceInterns` narrows by role above. Not exported: nothing outside
 * this module needs the unfiltered id list yet, and exporting it invites callers to
 * treat a raw member list as an intern list.
 */
const getActiveMemberUserIds = async (workspaceId) => {
  const workspace = await Workspace.findById(workspaceId).select('members').lean();
  if (!workspace) return [];

  return workspace.members
    .filter((member) => member.status === 'active' && member.user)
    .map((member) => member.user);
};

module.exports = { getActiveWorkspaceInterns };
