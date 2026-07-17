const mongoose = require('mongoose');
const crypto = require('crypto');
const { supabase, supabaseWorkspaceLogoBucket } = require('../config/supabase');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Invitation = require('../models/Invitation');
const {
  inviteExistingUserToWorkspace,
  cancelWorkspaceInvitationsForUser,
  cancelWorkspaceInvitation,
} = require('./invitationService');
const { seedDefaultCategories } = require('./categoryService');
const { createStatusesForWorkspace, validateStatusesPayload } = require('./statusService');
const { isActiveWorkspaceMember } = require('../helpers/workspaceAuthz');
const { ROLES } = require('../constants/roles');

const LOGO_MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const buildWorkspaceLogoPath = (workspaceId, mimeType) => {
  const ext = LOGO_MIME_TO_EXT[mimeType];
  if (!ext) throw new Error('Unsupported logo file type.');

  const ts = Date.now();
  const random = crypto.randomBytes(6).toString('hex');

  return `workspaces/${workspaceId}/logo/${ts}-${random}.${ext}`;
};

const buildWorkspaceLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  const { data } = supabase.storage.from(supabaseWorkspaceLogoBucket).getPublicUrl(logoPath);
  return data?.publicUrl || null;
};

const attachLogoUrl = (workspace) => {
  if (!workspace) return workspace;
  const plain = typeof workspace.toObject === 'function' ? workspace.toObject() : workspace;
  return {
    ...plain,
    logoUrl: buildWorkspaceLogoUrl(plain.logoPath),
  };
};

const createWorkspace = async ({ name, description, ownerId, statuses }) => {
  if (Array.isArray(statuses) && statuses.length > 0) {
    validateStatusesPayload(statuses);
  }

  const workspace = await Workspace.create({
    name,
    description,
    owner: ownerId,
    members: [{ user: ownerId, role: 'admin', status: 'active', joinedAt: new Date() }],
  });

  await User.findByIdAndUpdate(ownerId, { workspaceId: workspace._id });
  await seedDefaultCategories(workspace._id);
  await createStatusesForWorkspace(workspace._id, statuses);

  return attachLogoUrl(workspace);
};

const switchWorkspace = async ({ workspaceId, userId, userRole }) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  if (userRole === 'admin') {
    await User.findByIdAndUpdate(userId, { workspaceId });
    return { message: 'Switched workspace' };
  }

  const isMember = workspace.members.some(
    (m) => m.user.toString() === userId.toString() && m.status === 'active'
  );
  if (!isMember) throw new Error('Not a member of this workspace');

  await User.findByIdAndUpdate(userId, { workspaceId });
  return { message: 'Switched workspace' };
};

const getWorkspaceById = async (workspaceId, caller) => {
  const workspace = await Workspace.findById(workspaceId)
    .populate('owner', 'fullname email')
    .populate('members.user', 'fullname email role status');

  if (!workspace) throw new Error('Workspace not found');

  // Members list + pending invitations leak emails cross-tenant — restrict to
  // active members. Deliberately NOT hasWorkspaceAccess: its mentor bypass
  // would let any mentor read any workspace; only platform admins skip the
  // membership check here. Mentor owners/managers are always active members.
  if (caller && caller.role !== ROLES.ADMIN && !isActiveWorkspaceMember(workspace, caller.userId)) {
    const err = new Error('Forbidden: Not a member of this workspace');
    err.statusCode = 403;
    throw err;
  }

  const pendingInvitations = await Invitation.find({
    workspace: workspaceId,
    status: 'pending',
  })
    .populate('user', 'fullname email role status')
    .populate('invitedBy', 'fullname email')
    .sort({ createdAt: -1 });

  return {
    ...attachLogoUrl(workspace),
    pendingInvitations,
  };
};

const getUserWorkspaces = async (userId) => {
  const workspaces = await Workspace.find({
    isArchived: { $ne: true },
    members: { $elemMatch: { user: userId, status: 'active' } },
  })
    .populate('owner', 'fullname email')
    .lean();

  // Same card stats as getAllWorkspaces so the workspaces overview page can
  // render identically for admins (all) and mentors/members (their own).
  return Promise.all(
    workspaces.map(async (ws) => {
      const activeMembers = ws.members.filter((m) => m.status === 'active').length;
      const ticketCount = await Ticket.countDocuments({
        workspace: ws._id,
        isArchived: { $ne: true },
      });
      return {
        ...ws,
        logoUrl: buildWorkspaceLogoUrl(ws.logoPath),
        activeMemberCount: activeMembers,
        ticketCount,
      };
    })
  );
};

const updateWorkspace = async (workspaceId, { name, description, owner }, requestingUserId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  const updates = {};

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  if (owner !== undefined && owner !== workspace.owner?.toString()) {
    if (workspace.owner?.toString() !== requestingUserId?.toString()) {
      throw new Error('Only the workspace owner can transfer ownership');
    }

    const isActiveMember = workspace.members.some(
      (m) => m.user.toString() === owner && m.status === 'active'
    );
    if (!isActiveMember) {
      throw new Error('New owner must be an active member of the workspace');
    }

    updates.owner = owner;

    await Workspace.findByIdAndUpdate(workspaceId, {
      $set: updates,
    });

    return attachLogoUrl(
      await Workspace.findById(workspaceId)
        .populate('owner', 'fullname email')
        .populate('members.user', 'fullname email role status')
    );
  }

  if (Object.keys(updates).length > 0) {
    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );
    return attachLogoUrl(updatedWorkspace);
  }

  return attachLogoUrl(workspace);
};

const uploadWorkspaceLogo = async (workspaceId, file) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');
  if (!file) throw new Error('Logo file is required');

  const newLogoPath = buildWorkspaceLogoPath(workspaceId, file.mimetype);

  const { error: uploadError } = await supabase.storage
    .from(supabaseWorkspaceLogoBucket)
    .upload(newLogoPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload workspace logo');
  }

  const oldLogoPath = workspace.logoPath || null;
  workspace.logoPath = newLogoPath;
  await workspace.save();

  if (oldLogoPath) {
    const { error: removeError } = await supabase.storage
      .from(supabaseWorkspaceLogoBucket)
      .remove([oldLogoPath]);

    if (removeError) {
      console.error('[workspaceService] failed to remove old logo:', removeError.message);
    }
  }

  const updated = await Workspace.findById(workspaceId)
    .populate('owner', 'fullname email')
    .populate('members.user', 'fullname email role status');

  return attachLogoUrl(updated);
};

const deleteWorkspaceLogo = async (workspaceId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  if (workspace.logoPath) {
    const { error: removeError } = await supabase.storage
      .from(supabaseWorkspaceLogoBucket)
      .remove([workspace.logoPath]);

    if (removeError) {
      throw new Error(removeError.message || 'Failed to delete workspace logo');
    }
  }

  workspace.logoPath = null;
  await workspace.save();

  const updated = await Workspace.findById(workspaceId)
    .populate('owner', 'fullname email')
    .populate('members.user', 'fullname email role status');

  return attachLogoUrl(updated);
};

// Invite one or many existing users in a single call. Each invite is attempted
// independently — one failure (already a member, pending invite, etc.) does
// not abort the rest — and a per-user result is returned so the caller can
// report exactly which succeeded and which failed.
const inviteMembersToWorkspace = async ({ workspaceId, invites = [], inviterId }) => {
  if (!Array.isArray(invites) || invites.length === 0) {
    throw new Error('At least one invite is required');
  }

  // Existence check only — the per-user invite re-fetches the workspace it needs,
  // so avoid hydrating the full document here.
  const workspaceExists = await Workspace.exists({ _id: workspaceId });
  if (!workspaceExists) throw new Error('Workspace not found');

  const results = [];
  for (const invite of invites) {
    const userId = invite?.userId;
    const workspaceRole = invite?.role === 'admin' ? 'admin' : 'member';

    if (!userId) {
      results.push({ userId: userId ?? null, status: 'failed', message: 'User is required' });
      continue;
    }

    try {
      const result = await inviteExistingUserToWorkspace({
        workspaceId,
        userId,
        workspaceRole,
        inviterId,
      });
      results.push({ userId, status: 'invited', message: result.message });
    } catch (err) {
      results.push({ userId, status: 'failed', message: err.message });
    }
  }

  const invited = results.filter((r) => r.status === 'invited').length;
  const failed = results.length - invited;
  const message = failed
    ? `Invited ${invited} user${invited === 1 ? '' : 's'}, ${failed} failed`
    : `Invited ${invited} user${invited === 1 ? '' : 's'}`;

  return { message, results };
};

const removeMember = async ({ workspaceId, userId }) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  if (workspace.owner.toString() === userId) {
    throw new Error('Cannot remove the workspace owner');
  }

  workspace.members = workspace.members.filter((m) => m.user.toString() !== userId);
  await workspace.save();
  await cancelWorkspaceInvitationsForUser({ workspaceId, userId });

  // update workspaceId if this was the user's current workspace
  const user = await User.findById(userId);
  if (user && user.workspaceId?.toString() === workspaceId.toString()) {
    const fallback = await Workspace.findOne({
      _id: { $ne: workspaceId },
      members: { $elemMatch: { user: userId, status: 'active' } },
    });
    if (fallback) {
      await User.findByIdAndUpdate(userId, { workspaceId: fallback._id });
    } else {
      await User.findByIdAndUpdate(userId, { $unset: { workspaceId: '' } });
    }
  }

  return { message: 'Member removed' };
};

const cancelInvitation = async ({ workspaceId, invitationId }) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  return cancelWorkspaceInvitation({ workspaceId, invitationId });
};

const deleteWorkspace = async (workspaceId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ticketCount = await Ticket.countDocuments({ workspace: workspaceId }, { session });

    if (ticketCount === 0) {
      await Workspace.findByIdAndDelete(workspaceId, { session });
    } else {
      await Ticket.updateMany(
        { workspace: workspaceId },
        { $set: { isArchived: true } },
        { session }
      );
      await Workspace.findByIdAndUpdate(workspaceId, { $set: { isArchived: true } }, { session });
    }

    await Invitation.deleteMany({ workspace: workspaceId }, { session });

    const affectedUsers = await User.find(
      { workspaceId, role: { $ne: 'admin' } },
      { _id: 1 },
      { session }
    );

    for (const affectedUser of affectedUsers) {
      const fallback = await Workspace.findOne(
        {
          _id: { $ne: workspaceId },
          members: { $elemMatch: { user: affectedUser._id, status: 'active' } },
        },
        null,
        { session }
      );

      await User.findByIdAndUpdate(
        affectedUser._id,
        fallback ? { workspaceId: fallback._id } : { $unset: { workspaceId: '' } },
        { session }
      );
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  return { message: 'Workspace deleted' };
};

const getAllWorkspaces = async () => {
  const workspaces = await Workspace.find({ isArchived: { $ne: true } })
    .populate('owner', 'fullname email')
    .lean();

  const workspacesWithStats = await Promise.all(
    workspaces.map(async (ws) => {
      const activeMembers = ws.members.filter((m) => m.status === 'active').length;
      const ticketCount = await Ticket.countDocuments({
        workspace: ws._id,
        isArchived: { $ne: true },
      });
      return {
        ...ws,
        logoUrl: buildWorkspaceLogoUrl(ws.logoPath),
        activeMemberCount: activeMembers,
        ticketCount,
      };
    })
  );

  return workspacesWithStats;
};

module.exports = {
  createWorkspace,
  switchWorkspace,
  getWorkspaceById,
  getUserWorkspaces,
  updateWorkspace,
  inviteMembersToWorkspace,
  removeMember,
  cancelInvitation,
  getAllWorkspaces,
  deleteWorkspace,
  uploadWorkspaceLogo,
  deleteWorkspaceLogo,
};
