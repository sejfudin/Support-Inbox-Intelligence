const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const Integration = require('../models/Integration');
const { slugifyLabel, pickFallbackSlug } = require('./statusSlugAliases');

const buildFlagMap = (statuses) => Object.fromEntries(statuses.map((s) => [s._id.toString(), s]));

const auditWorkspace = async (workspace) => {
  const workspaceId = workspace._id;
  const statuses = await TicketStatus.find({ workspace: workspaceId })
    .sort({ sortOrder: 1 })
    .lean();
  const validIds = new Set(statuses.map((s) => s._id.toString()));
  const flagByStatusId = buildFlagMap(statuses);
  const statusById = Object.fromEntries(statuses.map((s) => [s._id.toString(), s]));

  const ticketStatusCounts = await Ticket.aggregate([
    {
      $match: {
        workspace: workspaceId,
        isArchived: { $ne: true },
      },
    },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const orphanRefs = [];
  const ticketsPerStatusId = {};

  for (const row of ticketStatusCounts) {
    const statusId = row._id;
    const idStr = statusId?.toString?.() || String(statusId || '');
    ticketsPerStatusId[idStr] = row.count;

    if (typeof statusId === 'string') {
      orphanRefs.push({
        statusId: idStr,
        slug: statusId,
        count: row.count,
        reason: 'string_status',
      });
      continue;
    }

    if (!idStr || !validIds.has(idStr)) {
      orphanRefs.push({
        statusId: idStr,
        slug: statusById[idStr]?.slug || '(unknown)',
        count: row.count,
        reason: 'broken_ref',
      });
    }
  }

  let missingDoneAt = 0;
  let missingInProgressAt = 0;
  let staleDoneAt = 0;
  let staleInProgressAt = 0;

  const doneStatusIds = statuses.filter((s) => s.isDone).map((s) => s._id);
  const tracksTimeStatusIds = statuses.filter((s) => s.tracksTime).map((s) => s._id);

  if (doneStatusIds.length) {
    missingDoneAt = await Ticket.countDocuments({
      workspace: workspaceId,
      isArchived: { $ne: true },
      status: { $in: doneStatusIds },
      doneAt: null,
    });
  }

  if (tracksTimeStatusIds.length) {
    missingInProgressAt = await Ticket.countDocuments({
      workspace: workspaceId,
      isArchived: { $ne: true },
      status: { $in: tracksTimeStatusIds },
      inProgressAt: null,
    });
  }

  if (doneStatusIds.length) {
    const nonDoneStatusIds = statuses.filter((s) => !s.isDone).map((s) => s._id);
    if (nonDoneStatusIds.length) {
      staleDoneAt = await Ticket.countDocuments({
        workspace: workspaceId,
        isArchived: { $ne: true },
        status: { $in: nonDoneStatusIds },
        doneAt: { $ne: null },
      });
    }
  }

  if (tracksTimeStatusIds.length) {
    const nonTrackStatusIds = statuses.filter((s) => !s.tracksTime).map((s) => s._id);
    if (nonTrackStatusIds.length) {
      staleInProgressAt = await Ticket.countDocuments({
        workspace: workspaceId,
        isArchived: { $ne: true },
        status: { $in: nonTrackStatusIds },
        inProgressAt: { $ne: null },
      });
    }
  }

  const integration = await Integration.findOne({ workspace: workspaceId })
    .select('settings isConnected')
    .lean();

  const validSlugs = new Set(statuses.map((s) => s.slug));
  const invalidIntegrationTargets = [];
  if (integration?.settings) {
    const { onPROpenTargetStatus, onMergeTargetStatus } = integration.settings;
    if (onPROpenTargetStatus && !validSlugs.has(slugifyLabel(onPROpenTargetStatus))) {
      invalidIntegrationTargets.push({
        field: 'onPROpenTargetStatus',
        value: onPROpenTargetStatus,
      });
    }
    if (onMergeTargetStatus && !validSlugs.has(slugifyLabel(onMergeTargetStatus))) {
      invalidIntegrationTargets.push({
        field: 'onMergeTargetStatus',
        value: onMergeTargetStatus,
      });
    }
  }

  const totalTickets = ticketStatusCounts.reduce((sum, row) => sum + row.count, 0);
  const orphanTicketCount = orphanRefs.reduce((sum, row) => sum + row.count, 0);

  return {
    workspaceId: workspaceId.toString(),
    workspaceName: workspace.name || '',
    statusCount: statuses.length,
    needsStatusSeed: statuses.length === 0,
    fallbackSlug: pickFallbackSlug(statuses),
    statuses: statuses.map((s) => ({
      id: s._id.toString(),
      slug: s.slug,
      label: s.label,
      isBacklog: s.isBacklog,
      tracksTime: s.tracksTime,
      isDone: s.isDone,
      ticketCount: ticketsPerStatusId[s._id.toString()] || 0,
    })),
    totalTickets,
    orphanRefs,
    orphanSlugs: orphanRefs.map((r) => ({
      slug: r.slug || r.statusId,
      count: r.count,
      reason: r.reason,
    })),
    orphanTicketCount,
    lifecycle: {
      missingDoneAt,
      missingInProgressAt,
      staleDoneAt,
      staleInProgressAt,
    },
    integration: {
      isConnected: Boolean(integration?.isConnected),
      invalidTargets: invalidIntegrationTargets,
    },
    flagByStatusId,
  };
};

const auditAllWorkspaces = async (workspaces) => {
  const reports = [];
  for (const workspace of workspaces) {
    reports.push(await auditWorkspace(workspace));
  }
  return reports;
};

const summarizeReports = (reports) => {
  const totals = {
    workspaces: reports.length,
    needsStatusSeed: 0,
    orphanTicketCount: 0,
    missingDoneAt: 0,
    missingInProgressAt: 0,
    staleDoneAt: 0,
    staleInProgressAt: 0,
    invalidIntegrationTargets: 0,
  };

  for (const report of reports) {
    if (report.needsStatusSeed) totals.needsStatusSeed += 1;
    totals.orphanTicketCount += report.orphanTicketCount;
    totals.missingDoneAt += report.lifecycle.missingDoneAt;
    totals.missingInProgressAt += report.lifecycle.missingInProgressAt;
    totals.staleDoneAt += report.lifecycle.staleDoneAt;
    totals.staleInProgressAt += report.lifecycle.staleInProgressAt;
    totals.invalidIntegrationTargets += report.integration.invalidTargets.length;
  }

  return totals;
};

module.exports = {
  auditWorkspace,
  auditAllWorkspaces,
  summarizeReports,
};
