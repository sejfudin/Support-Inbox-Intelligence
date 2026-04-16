const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Workspace = require('../models/Workspace');

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const roundTo = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const getUserAnalytics = async ({ userId, workspaceId, days = 30, requesterId }) => {
  if (!workspaceId) {
    throw new Error('WorkspaceId is required');
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid userId');
  }

  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new Error('Invalid workspaceId');
  }

  if (!mongoose.Types.ObjectId.isValid(requesterId)) {
    throw new Error('Invalid requesterId');
  }

  const parsedDays = Number.parseInt(days, 10);
  const safeDays = Number.isNaN(parsedDays) || parsedDays <= 0 ? 30 : parsedDays;

  const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const requesterObjectId = new mongoose.Types.ObjectId(requesterId);

  const workspace = await Workspace.findOne({
    _id: workspaceObjectId,
    isArchived: { $ne: true },
  }).select('members');

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const isRequesterMember = workspace.members.some(
    (member) => member.user && member.user.equals(requesterObjectId) && member.status === 'active',
  );

  if (!isRequesterMember) {
    throw new Error('Not a member of this workspace');
  }

  const isTargetUserMember = workspace.members.some(
    (member) => member.user && member.user.equals(userObjectId) && member.status === 'active',
  );

  if (!isTargetUserMember) {
    throw new Error('User is not an active member of this workspace');
  }

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startDate = new Date(todayUtc);
  startDate.setUTCDate(startDate.getUTCDate() - (safeDays - 1));

  const endExclusive = new Date(todayUtc);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const baseMatch = {
    workspace: workspaceObjectId,
    isArchived: { $ne: true },
    assignedTo: userObjectId,
  };

  const [summaryRaw, cycleRaw, timeRaw, workloadRaw, trendRaw] = await Promise.all([
    Ticket.aggregate([
      {
        $match: baseMatch,
      },
      {
        $group: {
          _id: null,
          completedTickets: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'done'] },
                    { $ne: ['$doneAt', null] },
                    { $gte: ['$doneAt', startDate] },
                    { $lt: ['$doneAt', endExclusive] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          activeTickets: {
            $sum: {
              $cond: [{ $eq: ['$status', 'in progress'] }, 1, 0],
            },
          },
          blockedTickets: {
            $sum: {
              $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          completedTickets: 1,
          activeTickets: 1,
          blockedTickets: 1,
        },
      },
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
          cycleMs: {
            $cond: [
              {
                $and: [
                  { $ne: ['$doneAt', null] },
                  { $ne: ['$inProgressAt', null] },
                ],
              },
              { $subtract: ['$doneAt', '$inProgressAt'] },
              null,
            ],
          },
        },
      },
      {
        $match: {
          cycleMs: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          averageCycleTimeDays: {
            $avg: {
              $divide: ['$cycleMs', ONE_DAY_MS],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          averageCycleTimeDays: 1,
        },
      },
    ]),
    Ticket.aggregate([
      {
        $match: baseMatch,
      },
      {
        $group: {
          _id: null,
          totalTimeSpentSeconds: {
            $sum: {
              $ifNull: ['$totalTimeSpent', 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalTimeSpentSeconds: 1,
        },
      },
    ]),
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
          _id: '$priority',
          value: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          priority: '$_id',
          value: 1,
        },
      },
    ]),
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
  ]);

  const summaryStats = summaryRaw[0] || {
    completedTickets: 0,
    activeTickets: 0,
    blockedTickets: 0,
  };

  const averageCycleTimeDays = cycleRaw[0]?.averageCycleTimeDays || 0;
  const totalTimeSpentSeconds = timeRaw[0]?.totalTimeSpentSeconds || 0;

  const priorityLabels = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };

  const workloadMap = new Map(
    workloadRaw
      .filter((item) => item.priority)
      .map((item) => [item.priority, item.value]),
  );

  const workloadDistribution = Object.keys(priorityLabels).map((priorityKey) => ({
    name: priorityLabels[priorityKey],
    value: workloadMap.get(priorityKey) || 0,
  }));

  const dateSeries = [];
  for (let i = 0; i < safeDays; i += 1) {
    const current = new Date(startDate);
    current.setUTCDate(startDate.getUTCDate() + i);
    dateSeries.push(current.toISOString().slice(0, 10));
  }

  const trendMap = new Map(trendRaw.map((item) => [item.date, item.completed]));
  const activityTrend = dateSeries.map((date) => ({
    date,
    completed: trendMap.get(date) || 0,
  }));

  return {
    summaryStats,
    performanceMetrics: {
      averageCycleTimeDays: roundTo(averageCycleTimeDays, 2),
      totalTimeSpentHours: roundTo(totalTimeSpentSeconds / 3600, 2),
    },
    workloadDistribution,
    activityTrend,
  };
};

module.exports = {
  getUserAnalytics,
};
