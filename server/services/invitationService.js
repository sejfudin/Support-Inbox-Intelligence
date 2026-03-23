const Invitation = require("../models/Invitation");
const User = require("../models/User");
const Workspace = require("../models/Workspace");

const prepareInvitedUser = async ({
  user,
  fullName,
  normalizedEmail,
  inviterId,
}) => {
  const inviteUser = user || new User();

  inviteUser.fullname = fullName;
  inviteUser.email = normalizedEmail;
  inviteUser.active = false;
  inviteUser.status = "invited";
  inviteUser.invitedBy = inviterId;
  inviteUser.invitedAt = new Date();
  inviteUser.inviteAcceptedAt = null;
  inviteUser.inviteSetupSessionHash = null;
  inviteUser.inviteSetupSessionExpires = null;

  await inviteUser.save();
  return { inviteUser };
};

const ensureWorkspaceInviteAllowed = async ({ workspace, user }) => {
  const activeMember = workspace.members.find(
    (member) =>
      member.user.toString() === user._id.toString() && member.status === "active"
  );

  if (activeMember) {
    throw new Error("User is already a member of this workspace");
  }

  const pendingInvitation = await Invitation.findOne({
    user: user._id,
    workspace: workspace._id,
    status: "pending",
  });

  if (pendingInvitation) {
    throw new Error("User already has a pending invitation for this workspace");
  }
};

const createWorkspaceInvitation = async ({
  workspaceId,
  fullName,
  email,
  workspaceRole = "member",
  inviterId,
}) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error("Workspace not found");

  const normalizedEmail = String(email).trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });
  const isActiveUser = user?.status === "active";

  if (user) {
    await ensureWorkspaceInviteAllowed({ workspace, user });
  }

  if (!user || !isActiveUser) {
    const inviteResult = await prepareInvitedUser({
      user,
      fullName,
      normalizedEmail,
      inviterId,
    });
    user = inviteResult.inviteUser;
  }

  const invitation = await Invitation.create({
    user: user._id,
    workspace: workspace._id,
    invitedBy: inviterId,
    workspaceRole,
  });

  return {
    message: isActiveUser ? "Invitation sent in-app" : "User created and invitation sent",
    invitation,
  };
};

const inviteExistingUserToWorkspace = async ({
  workspaceId,
  userId,
  workspaceRole = "member",
  inviterId,
}) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error("Workspace not found");

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  await ensureWorkspaceInviteAllowed({ workspace, user });

  const invitation = await Invitation.create({
    user: user._id,
    workspace: workspace._id,
    invitedBy: inviterId,
    workspaceRole,
  });

  return {
    message: "Invitation sent in-app",
    invitation,
  };
};

const listUserInvitations = async (userId) => {
  return Invitation.find({
    user: userId,
    status: "pending",
  })
    .populate("workspace", "name description owner")
    .populate("invitedBy", "fullname email")
    .sort({ createdAt: -1 });
};

const acceptInvitation = async ({ invitationId, userId }) => {
  const invitation = await Invitation.findOne({
    _id: invitationId,
    user: userId,
    status: "pending",
  });

  if (!invitation) throw new Error("Invitation not found");

  const workspace = await Workspace.findById(invitation.workspace);
  if (!workspace) throw new Error("Workspace not found");

  const memberIndex = workspace.members.findIndex(
    (member) => member.user.toString() === userId.toString()
  );

  if (memberIndex >= 0) {
    workspace.members[memberIndex].status = "active";
    workspace.members[memberIndex].role = invitation.workspaceRole;
    workspace.members[memberIndex].invitedBy = invitation.invitedBy;
  } else {
    workspace.members.push({
      user: userId,
      role: invitation.workspaceRole,
      status: "active",
      invitedBy: invitation.invitedBy,
    });
  }

  await workspace.save();

  await User.findByIdAndUpdate(userId, { workspaceId: workspace._id });

  invitation.status = "accepted";
  invitation.respondedAt = new Date();
  await invitation.save();

  return { message: "Invitation accepted", workspaceId: workspace._id };
};

const declineInvitation = async ({ invitationId, userId }) => {
  const invitation = await Invitation.findOne({
    _id: invitationId,
    user: userId,
    status: "pending",
  });

  if (!invitation) throw new Error("Invitation not found");

  invitation.status = "declined";
  invitation.respondedAt = new Date();
  await invitation.save();

  return { message: "Invitation declined" };
};

const cancelWorkspaceInvitationsForUser = async ({ workspaceId, userId }) => {
  await Invitation.updateMany(
    { workspace: workspaceId, user: userId, status: "pending" },
    { $set: { status: "cancelled", respondedAt: new Date() } }
  );
};

module.exports = {
  createWorkspaceInvitation,
  inviteExistingUserToWorkspace,
  listUserInvitations,
  acceptInvitation,
  declineInvitation,
  cancelWorkspaceInvitationsForUser,
};
