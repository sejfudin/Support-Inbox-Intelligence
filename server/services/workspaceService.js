const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Invitation = require('../models/Invitation');
const {
  inviteExistingUserToWorkspace,
  cancelWorkspaceInvitationsForUser,
} = require('./invitationService');

const createWorkspace = async ({ name, description, ownerId }) => {
  const workspace = await Workspace.create({
    name,
    description,
    owner: ownerId,
    members: [{ user: ownerId, role: 'admin', status: 'active' }],
  });

  await User.findByIdAndUpdate(ownerId, { workspaceId: workspace._id });

  return workspace;
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

const getWorkspaceById = async (workspaceId) => {
  const workspace = await Workspace.findById(workspaceId)
    .populate('owner', 'fullname email')
    .populate('members.user', 'fullname email role status');

  if (!workspace) throw new Error('Workspace not found');

  const pendingInvitations = await Invitation.find({
    workspace: workspaceId,
    status: 'pending',
  })
    .populate('user', 'fullname email role status')
    .populate('invitedBy', 'fullname email')
    .sort({ createdAt: -1 });

  return {
    ...workspace.toObject(),
    pendingInvitations,
  };
};

const getUserWorkspaces = async (userId) => {
  const workspaces = await Workspace.find({
    members: { $elemMatch: { user: userId, status: 'active' } },
  }).populate('owner', 'fullname email');

  return workspaces;
};

const updateWorkspace = async (workspaceId, { name, description }) => {
  const workspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    { $set: { name, description } },
    { new: true, runValidators: true }
  );

  if (!workspace) throw new Error('Workspace not found');
  return workspace;
};

const inviteMemberToWorkspace = async ({
  workspaceId,
  userId,
  role = 'member',
  inviterId,
}) => {
  if (!userId) throw new Error('User is required');

  const workspaceRole = role === 'admin' ? 'admin' : 'member';
  const result = await inviteExistingUserToWorkspace({
    workspaceId,
    userId,
    workspaceRole,
    inviterId,
  });

  return { message: result.message };
};

const removeMember = async ({ workspaceId, userId }) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  if (workspace.owner.toString() === userId) {
    throw new Error('Cannot remove the workspace owner');
  }

  workspace.members = workspace.members.filter(
    (m) => m.user.toString() !== userId
  );
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
      await Ticket.updateMany({ workspace: workspaceId }, { $set: { isArchived: true } }, { session });
      await Workspace.findByIdAndUpdate(workspaceId, { $set: { isArchived: true } }, { session });
    }

    await Invitation.deleteMany({ workspace: workspaceId }, { session });
    await User.updateMany({ workspaceId, role: { $ne: 'admin' } }, { $unset: { workspaceId: '' } }, { session });

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
      return { ...ws, activeMemberCount: activeMembers, ticketCount };
    })
  );

  return workspacesWithStats;
};

const getWorkspaceAnalytics = async ({ workspaceId, days = 30 }) => {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new Error('Invalid workspaceId');
  }

  const parsedDays = Number.parseInt(days, 10);
  const allowedDays = new Set([7, 15, 30]);
  const safeDays = allowedDays.has(parsedDays) ? parsedDays : 30;

  const workspaceExists = await Workspace.exists({
    _id: workspaceId,
    isArchived: { $ne: true },
  });

  if (!workspaceExists) {
    throw new Error('Workspace not found');
  }

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startDate = new Date(todayUtc);
  startDate.setUTCDate(startDate.getUTCDate() - (safeDays - 1));

  const endExclusive = new Date(todayUtc);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const baseMatch = {
    workspace: new mongoose.Types.ObjectId(workspaceId),
    isArchived: { $ne: true },
  };

  const [throughputRaw, creationRaw, cycleRaw] = await Promise.all([
    Ticket.aggregate([
      {
        $match: {
          ...baseMatch,
          status: 'done',
          doneAt: { $gte: startDate, $lt: endExclusive, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$doneAt', timezone: 'UTC' },
          },
          completed: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: '$_id', completed: 1 } },
      { $sort: { date: 1 } },
    ]),
    Ticket.aggregate([
      {
        $match: {
          ...baseMatch,
          createdAt: { $gte: startDate, $lt: endExclusive },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
          },
          created: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: '$_id', created: 1 } },
      { $sort: { date: 1 } },
    ]),
    Ticket.aggregate([
      {
        $match: {
          ...baseMatch,
          status: 'done',
          doneAt: { $gte: startDate, $lt: endExclusive, $ne: null },
          inProgressAt: { $ne: null },
        },
      },
      {
        $addFields: {
          cycleMs: { $subtract: ['$doneAt', '$inProgressAt'] },
        },
      },
      {
        $match: {
          cycleMs: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$doneAt', timezone: 'UTC' },
          },
          avgDays: {
            $avg: {
              $divide: ['$cycleMs', 1000 * 60 * 60 * 24],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          avgDays: { $round: ['$avgDays', 2] },
        },
      },
      { $sort: { date: 1 } },
    ]),
  ]);

  const dateSeries = [];
  for (let i = 0; i < safeDays; i += 1) {
    const current = new Date(startDate);
    current.setUTCDate(startDate.getUTCDate() + i);
    dateSeries.push(current.toISOString().slice(0, 10));
  }

  const throughputMap = new Map(throughputRaw.map((item) => [item.date, item.completed]));
  const creationMap = new Map(creationRaw.map((item) => [item.date, item.created]));
  const cycleMap = new Map(cycleRaw.map((item) => [item.date, item.avgDays]));

  const throughput = dateSeries.map((date) => ({
    date,
    completed: throughputMap.get(date) || 0,
  }));

  const creationTrend = dateSeries.map((date) => ({
    date,
    created: creationMap.get(date) || 0,
  }));

  const averageCycleTime = dateSeries.map((date) => ({
    date,
    avgDays: cycleMap.get(date) || 0,
  }));

  return {
    throughput,
    creationTrend,
    averageCycleTime,
  };
};

module.exports = {
  createWorkspace,
  switchWorkspace,
  getWorkspaceById,
  getUserWorkspaces,
  updateWorkspace,
  inviteMemberToWorkspace,
  removeMember,
  getAllWorkspaces,
  deleteWorkspace,
  getWorkspaceAnalytics,
};
