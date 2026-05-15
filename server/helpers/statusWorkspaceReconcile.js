const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const Integration = require('../models/Integration');
const {
  resolveTicketStatusSlug,
  pickFallbackSlug,
  buildLifecyclePatch,
  patchIsEmpty,
  slugifyLabel,
} = require('./statusSlugAliases');
const { auditWorkspace } = require('./statusWorkspaceAudit');
const {
  seedDefaultStatuses,
  resolveIntegrationStatusTargets,
} = require('../services/statusService');

const reconcileWorkspace = async (workspace, { dryRun = true } = {}) => {
  const workspaceId = workspace._id;
  const summary = {
    workspaceId: workspaceId.toString(),
    workspaceName: workspace.name || '',
    dryRun,
    statusesSeeded: false,
    slugUpdates: 0,
    lifecycleUpdates: 0,
    integrationRepairs: 0,
    slugSamples: [],
    lifecycleSamples: [],
  };

  let statuses = await TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean();

  if (statuses.length === 0) {
    if (!dryRun) {
      await seedDefaultStatuses(workspaceId);
    }
    summary.statusesSeeded = true;
    statuses = await TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean();
  }

  const validSlugs = new Set(statuses.map((s) => s.slug));
  const flagBySlug = Object.fromEntries(statuses.map((s) => [s.slug, s]));
  const fallbackSlug = pickFallbackSlug(statuses);

  const cursor = Ticket.find({
    workspace: workspaceId,
    isArchived: { $ne: true },
  })
    .select('_id status doneAt inProgressAt updatedAt createdAt')
    .cursor();

  for await (const ticket of cursor) {
    const resolved = resolveTicketStatusSlug(ticket.status, validSlugs, { fallbackSlug });
    const flags = flagBySlug[resolved.slug];
    const updates = {};

    if (ticket.status !== resolved.slug) {
      updates.status = resolved.slug;
      summary.slugUpdates += 1;
      if (summary.slugSamples.length < 5) {
        summary.slugSamples.push({
          ticketId: ticket._id.toString(),
          from: ticket.status,
          to: resolved.slug,
          mapped: resolved.mapped,
        });
      }
    }

    const lifecyclePatch = buildLifecyclePatch(
      { ...ticket.toObject(), status: resolved.slug },
      flags
    );
    Object.assign(updates, lifecyclePatch);

    if (!patchIsEmpty(lifecyclePatch)) {
      summary.lifecycleUpdates += 1;
      if (summary.lifecycleSamples.length < 5) {
        summary.lifecycleSamples.push({
          ticketId: ticket._id.toString(),
          patch: lifecyclePatch,
        });
      }
    }

    if (!dryRun && Object.keys(updates).length > 0) {
      await Ticket.updateOne({ _id: ticket._id }, { $set: updates });
    }
  }

  const integration = await Integration.findOne({ workspace: workspaceId });
  if (integration) {
    const targets = await resolveIntegrationStatusTargets(workspaceId);
    const settings = integration.settings || {};
    const repairs = {};

    if (
      !settings.onMergeTargetStatus ||
      !validSlugs.has(slugifyLabel(settings.onMergeTargetStatus))
    ) {
      repairs.onMergeTargetStatus = targets.onMergeTargetStatus;
    }
    if (
      !settings.onPROpenTargetStatus ||
      !validSlugs.has(slugifyLabel(settings.onPROpenTargetStatus))
    ) {
      repairs.onPROpenTargetStatus = targets.onPROpenTargetStatus;
    }

    if (Object.keys(repairs).length > 0) {
      summary.integrationRepairs += 1;
      if (!dryRun) {
        integration.settings = { ...settings, ...repairs };
        await integration.save();
      }
    }
  }

  summary.postAudit = await auditWorkspace(workspace);
  return summary;
};

const reconcileAllWorkspaces = async (workspaces, options) => {
  const results = [];
  for (const workspace of workspaces) {
    results.push(await reconcileWorkspace(workspace, options));
  }
  return results;
};

module.exports = {
  reconcileWorkspace,
  reconcileAllWorkspaces,
};
