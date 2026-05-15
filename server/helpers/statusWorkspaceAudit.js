const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const Integration = require('../models/Integration');
const { slugifyLabel, pickFallbackSlug } = require('./statusSlugAliases');

const buildFlagMap = (statuses) =>
  Object.fromEntries(statuses.map((s) => [s.slug, s]));

const auditWorkspace = async (workspace) => {
  const workspaceId = workspace._id;
  const statuses = await TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean();
  const validSlugs = new Set(statuses.map((s) => s.slug));
  const flagBySlug = buildFlagMap(statuses);

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

  const orphanSlugs = [];
  const ticketsPerSlug = {};

  for (const row of ticketStatusCounts) {
    const slug = row._id ?? '';
    const normalized = slugifyLabel(slug);
    ticketsPerSlug[slug] = row.count;
    if (!validSlugs.has(normalized) && slug !== '') {
      orphanSlugs.push({ slug, count: row.count });
    }
  }

  let missingDoneAt = 0;
  let missingInProgressAt = 0;
  let staleDoneAt = 0;
  let staleInProgressAt = 0;

  const doneSlugs = statuses.filter((s) => s.isDone).map((s) => s.slug);
  const tracksTimeSlugs = statuses.filter((s) => s.tracksTime).map((s) => s.slug);

  if (doneSlugs.length) {
    missingDoneAt = await Ticket.countDocuments({
      workspace: workspaceId,
      isArchived: { $ne: true },
      status: { $in: doneSlugs },
      doneAt: null,
    });
  }

  if (tracksTimeSlugs.length) {
    missingInProgressAt = await Ticket.countDocuments({
      workspace: workspaceId,
      isArchived: { $ne: true },
      status: { $in: tracksTimeSlugs },
      inProgressAt: null,
    });
  }

  if (doneSlugs.length) {
    const nonDoneSlugs = statuses.filter((s) => !s.isDone).map((s) => s.slug);
    if (nonDoneSlugs.length) {
      staleDoneAt = await Ticket.countDocuments({
        workspace: workspaceId,
        isArchived: { $ne: true },
        status: { $in: nonDoneSlugs },
        doneAt: { $ne: null },
      });
    }
  }

  if (tracksTimeSlugs.length) {
    const nonTrackSlugs = statuses.filter((s) => !s.tracksTime).map((s) => s.slug);
    if (nonTrackSlugs.length) {
      staleInProgressAt = await Ticket.countDocuments({
        workspace: workspaceId,
        isArchived: { $ne: true },
        status: { $in: nonTrackSlugs },
        inProgressAt: { $ne: null },
      });
    }
  }

  const integration = await Integration.findOne({ workspace: workspaceId })
    .select('settings isConnected')
    .lean();

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
  const orphanTicketCount = orphanSlugs.reduce((sum, row) => sum + row.count, 0);

  return {
    workspaceId: workspaceId.toString(),
    workspaceName: workspace.name || '',
    statusCount: statuses.length,
    needsStatusSeed: statuses.length === 0,
    fallbackSlug: pickFallbackSlug(statuses),
    statuses: statuses.map((s) => ({
      slug: s.slug,
      label: s.label,
      isBacklog: s.isBacklog,
      tracksTime: s.tracksTime,
      isDone: s.isDone,
      ticketCount: ticketsPerSlug[s.slug] || 0,
    })),
    totalTickets,
    orphanSlugs,
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
    flagBySlug,
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
