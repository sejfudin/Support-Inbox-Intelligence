const Invitation = require('../models/Invitation');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { sendToUser } = require('../socket/socketServer');
const { invalidationScopes } = require('../socket/invalidationScopes');
const { userSelect } = require('../constants/userSelect');

const emitInvitationInvalidation = (userId) => {
  sendToUser(userId, 'CACHE_INVALIDATED', {
    scopes: [invalidationScopes.user(userId)],
  });
};

const ensureWorkspaceInviteAllowed = async ({ workspace, user }) => {
  const activeMember = workspace.members.find(
    (member) => member.user.toString() === user._id.toString() && member.status === 'active'
  );

  if (activeMember) {
    throw new Error('User is already a member of this workspace');
  }

  const pendingInvitation = await Invitation.findOne({
    user: user._id,
    workspace: workspace._id,
    status: 'pending',
  });

  if (pendingInvitation) {
    throw new Error('User already has a pending invitation for this workspace');
  }
};

const inviteExistingUserToWorkspace = async ({
  workspaceId,
  userId,
  workspaceRole = 'member',
  inviterId,
}) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  await ensureWorkspaceInviteAllowed({ workspace, user });

  const invitation = await Invitation.create({
    user: user._id,
    workspace: workspace._id,
    invitedBy: inviterId,
    workspaceRole,
  });

  emitInvitationInvalidation(user._id);

  return {
    message: 'Invitation sent in-app',
    invitation,
  };
};

const listUserInvitations = async (userId) => {
  return Invitation.find({
    user: userId,
    status: 'pending',
  })
    .populate('workspace', 'name description owner')
    .populate('invitedBy', userSelect())
    .sort({ createdAt: -1 });
};

const acceptInvitation = async ({ invitationId, userId }) => {
  const invitation = await Invitation.findOne({
    _id: invitationId,
    user: userId,
    status: 'pending',
  });

  if (!invitation) throw new Error('Invitation not found');

  const workspace = await Workspace.findById(invitation.workspace);
  if (!workspace) throw new Error('Workspace not found');

  const memberIndex = workspace.members.findIndex(
    (member) => member.user.toString() === userId.toString()
  );
  const joinedAt = new Date();

  if (memberIndex >= 0) {
    workspace.members[memberIndex].status = 'active';
    workspace.members[memberIndex].role = invitation.workspaceRole;
    workspace.members[memberIndex].invitedBy = invitation.invitedBy;
    workspace.members[memberIndex].joinedAt = joinedAt;
  } else {
    workspace.members.push({
      user: userId,
      role: invitation.workspaceRole,
      status: 'active',
      invitedBy: invitation.invitedBy,
      joinedAt,
    });
  }

  await workspace.save();

  const acceptingUser = await User.findById(userId).select('workspaceId');
  const becameActiveWorkspace = !acceptingUser?.workspaceId;
  if (becameActiveWorkspace) {
    await User.findByIdAndUpdate(userId, { workspaceId: workspace._id });
  }

  invitation.status = 'accepted';
  invitation.respondedAt = new Date();
  await invitation.save();

  emitInvitationInvalidation(userId);

  return { message: 'Invitation accepted', workspaceId: workspace._id, becameActiveWorkspace };
};

const declineInvitation = async ({ invitationId, userId }) => {
  const invitation = await Invitation.findOne({
    _id: invitationId,
    user: userId,
    status: 'pending',
  });

  if (!invitation) throw new Error('Invitation not found');

  invitation.status = 'declined';
  invitation.respondedAt = new Date();
  await invitation.save();

  emitInvitationInvalidation(userId);

  return { message: 'Invitation declined' };
};

const cancelWorkspaceInvitationsForUser = async ({ workspaceId, userId }) => {
  await Invitation.updateMany(
    { workspace: workspaceId, user: userId, status: 'pending' },
    { $set: { status: 'cancelled', respondedAt: new Date() } }
  );
  emitInvitationInvalidation(userId);
};

// Cancel a single pending invitation by its own id. Unlike
// cancelWorkspaceInvitationsForUser, this does not depend on the invited user
// still existing, so it can also clear "orphaned" invitations whose referenced
// user has been removed (which otherwise become impossible to cancel from the UI).
const cancelWorkspaceInvitation = async ({ workspaceId, invitationId }) => {
  const invitation = await Invitation.findOne({
    _id: invitationId,
    workspace: workspaceId,
    status: 'pending',
  });

  if (!invitation) throw new Error('Invitation not found');

  invitation.status = 'cancelled';
  invitation.respondedAt = new Date();
  await invitation.save();

  if (invitation.user) emitInvitationInvalidation(invitation.user);

  return { message: 'Invitation cancelled' };
};

module.exports = {
  inviteExistingUserToWorkspace,
  listUserInvitations,
  acceptInvitation,
  declineInvitation,
  cancelWorkspaceInvitationsForUser,
  cancelWorkspaceInvitation,
};
