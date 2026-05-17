const TicketStatus = require('../models/TicketStatus');
const Ticket = require('../models/Ticket');
const { pickFallbackSlug } = require('../helpers/statusSlugAliases');
const {
  StatusValidationError,
  validateStatusesPayload,
  validateStatusLabel,
  assertWorkspaceBehaviorFlags,
  assertUniqueLabelInWorkspace,
  mapStatusPersistenceError,
} = require('../helpers/statusValidation');

const DEFAULT_STATUSES = [
  { slug: 'backlog', label: 'Backlog', color: '#6b7280', isBacklog: true, tracksTime: false, isDone: false },
  { slug: 'to do', label: 'To do', color: '#64748b', isBacklog: false, tracksTime: false, isDone: false },
  {
    slug: 'in progress',
    label: 'In progress',
    color: '#3b82f6',
    isBacklog: false,
    tracksTime: true,
    isDone: false,
  },
  {
    slug: 'on staging',
    label: 'On staging',
    color: '#8b5cf6',
    isBacklog: false,
    tracksTime: false,
    isDone: false,
  },
  { slug: 'blocked', label: 'Blocked', color: '#ef4444', isBacklog: false, tracksTime: false, isDone: false },
  { slug: 'done', label: 'Done', color: '#22c55e', isBacklog: false, tracksTime: false, isDone: true },
];

const slugifyLabel = (label) =>
  String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const generateUniqueSlug = async (workspaceId, label, excludeId = null) => {
  const base = slugifyLabel(label) || 'status';
  let candidate = base;
  let suffix = 2;

  while (true) {
    const query = { workspace: workspaceId, slug: candidate };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const exists = await TicketStatus.exists(query);
    if (!exists) return candidate;
    candidate = `${base} ${suffix}`;
    suffix += 1;
  }
};

const countMainBoardStatuses = async (workspaceId, excludeId = null) => {
  const query = { workspace: workspaceId, isBacklog: false };
  if (excludeId) query._id = { $ne: excludeId };
  return TicketStatus.countDocuments(query);
};

const seedDefaultStatuses = async (workspaceId) => {
  const existing = await TicketStatus.countDocuments({ workspace: workspaceId });
  if (existing > 0) return getWorkspaceStatuses(workspaceId);

  const docs = DEFAULT_STATUSES.map((s, index) => ({
    ...s,
    workspace: workspaceId,
    sortOrder: index,
  }));
  await TicketStatus.insertMany(docs);
  return getWorkspaceStatuses(workspaceId);
};

const createStatusesForWorkspace = async (workspaceId, statusesPayload = []) => {
  const existing = await TicketStatus.countDocuments({ workspace: workspaceId });
  if (existing > 0) {
    return getWorkspaceStatuses(workspaceId);
  }

  if (!Array.isArray(statusesPayload) || statusesPayload.length === 0) {
    return seedDefaultStatuses(workspaceId);
  }

  validateStatusesPayload(statusesPayload);

  const docs = [];
  for (let i = 0; i < statusesPayload.length; i += 1) {
    const item = statusesPayload[i];
    const label = validateStatusLabel(item.label);
    const slug = item.slug ? slugifyLabel(item.slug) : await generateUniqueSlug(workspaceId, label);

    docs.push({
      workspace: workspaceId,
      slug,
      label,
      color: item.color || '#6366f1',
      sortOrder: i,
      isBacklog: Boolean(item.isBacklog),
      tracksTime: Boolean(item.tracksTime),
      isDone: Boolean(item.isDone),
    });
  }

  try {
    await TicketStatus.insertMany(docs);
  } catch (error) {
    throw mapStatusPersistenceError(error);
  }

  return getWorkspaceStatuses(workspaceId);
};

const getWorkspaceStatuses = async (workspaceId) => {
  return TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean();
};

const getStatusBySlug = async (workspaceId, slug) => {
  return TicketStatus.findOne({ workspace: workspaceId, slug: slugifyLabel(slug) }).lean();
};

const validateStatusForWorkspace = async (workspaceId, slug) => {
  if (!workspaceId || !slug) {
    throw new Error('Invalid status');
  }
  const status = await getStatusBySlug(workspaceId, slug);
  if (!status) {
    throw new Error(`Status "${slug}" is not valid for this workspace`);
  }
  return status;
};

const getStatusFlags = async (workspaceId, slug) => {
  const status = await validateStatusForWorkspace(workspaceId, slug);
  return {
    tracksTime: status.tracksTime,
    isDone: status.isDone,
    isBacklog: status.isBacklog,
  };
};

const getBacklogSlugs = async (workspaceId) => {
  const statuses = await TicketStatus.find({ workspace: workspaceId, isBacklog: true })
    .select('slug')
    .lean();
  if (statuses.length > 0) return statuses.map((s) => s.slug);
  return ['backlog'];
};

const getBacklogStatusIds = async (workspaceId) => {
  const statuses = await TicketStatus.find({ workspace: workspaceId, isBacklog: true })
    .select('_id')
    .lean();
  return statuses.map((s) => s._id);
};

const getStatusIdForSlug = async (workspaceId, slug) => {
  const status = await validateStatusForWorkspace(workspaceId, slug);
  return status._id;
};

const resolveStatusSlugFromTicketRef = async (statusRef) => {
  if (!statusRef) return '';
  if (typeof statusRef === 'object' && statusRef.slug) {
    return String(statusRef.slug).toLowerCase();
  }
  const doc = await TicketStatus.findById(statusRef).select('slug').lean();
  return doc?.slug ? String(doc.slug).toLowerCase() : '';
};

const statusIdsMatch = (a, b) => {
  if (!a || !b) return false;
  return String(a) === String(b);
};

const getStatusIdSets = async (workspaceId) => {
  const statuses = await getWorkspaceStatuses(workspaceId);
  if (statuses.length === 0) {
    console.error(
      `[statusService] No TicketStatus rows for workspace ${workspaceId}; ID sets empty. Run migrateTicketStatuses.js.`
    );
    return { doneIds: [], tracksTimeIds: [], activeIds: [] };
  }

  return {
    doneIds: statuses.filter((s) => s.isDone).map((s) => s._id),
    tracksTimeIds: statuses.filter((s) => s.tracksTime).map((s) => s._id),
    activeIds: statuses.filter((s) => !s.isBacklog && !s.isDone).map((s) => s._id),
  };
};

const getStatusSlugSets = async (workspaceId) => {
  const statuses = await getWorkspaceStatuses(workspaceId);
  if (statuses.length === 0) {
    console.error(
      `[statusService] No TicketStatus rows for workspace ${workspaceId}; using legacy slug fallbacks. Run migrateTicketStatuses.js.`
    );
    return {
      doneSlugs: ['done'],
      tracksTimeSlugs: ['in progress'],
      activeSlugs: ['to do', 'in progress', 'on staging', 'blocked'],
    };
  }

  return {
    doneSlugs: statuses.filter((s) => s.isDone).map((s) => s.slug),
    tracksTimeSlugs: statuses.filter((s) => s.tracksTime).map((s) => s.slug),
    activeSlugs: statuses.filter((s) => !s.isBacklog && !s.isDone).map((s) => s.slug),
  };
};

const resolveIntegrationStatusTargets = async (workspaceId) => {
  const statuses = await getWorkspaceStatuses(workspaceId);
  if (statuses.length === 0) {
    return {
      onMergeTargetStatus: 'done',
      onPROpenTargetStatus: 'on staging',
    };
  }

  const done = statuses.find((s) => s.isDone);
  const tracks = statuses.find((s) => s.tracksTime);
  const mainBoard = statuses.filter((s) => !s.isBacklog && !s.isDone);
  const prOpen =
    mainBoard.find((s) => !s.tracksTime)?.slug ||
    tracks?.slug ||
    mainBoard[0]?.slug ||
    pickFallbackSlug(statuses);

  return {
    onMergeTargetStatus: done?.slug || pickFallbackSlug(statuses),
    onPROpenTargetStatus: prOpen,
  };
};

const normalizeIntegrationSettings = async (workspaceId, settings = {}) => {
  const defaults = await resolveIntegrationStatusTargets(workspaceId);
  const validSlugs = new Set((await getWorkspaceStatuses(workspaceId)).map((s) => s.slug));

  const mergeSlug = settings.onMergeTargetStatus
    ? slugifyLabel(settings.onMergeTargetStatus)
    : '';
  const prOpenSlug = settings.onPROpenTargetStatus
    ? slugifyLabel(settings.onPROpenTargetStatus)
    : '';

  return {
    autoLinkEnabled: settings.autoLinkEnabled !== false,
    autoMoveOnPROpenEnabled: Boolean(settings.autoMoveOnPROpenEnabled),
    autoMoveOnMergeEnabled: Boolean(settings.autoMoveOnMergeEnabled),
    onMergeTargetStatus:
      mergeSlug && validSlugs.has(mergeSlug) ? mergeSlug : defaults.onMergeTargetStatus,
    onPROpenTargetStatus:
      prOpenSlug && validSlugs.has(prOpenSlug) ? prOpenSlug : defaults.onPROpenTargetStatus,
  };
};

const resolveAutomationTargetStatus = async (workspaceId, preferredSlug, role) => {
  const statuses = await getWorkspaceStatuses(workspaceId);
  if (statuses.length === 0) {
    if (role === 'done') return preferredSlug || 'done';
    return preferredSlug || 'on staging';
  }

  const normalizedPreferred = preferredSlug ? slugifyLabel(preferredSlug) : null;
  if (normalizedPreferred) {
    const match = statuses.find((s) => s.slug === normalizedPreferred);
    if (match) return match.slug;
  }

  if (role === 'done') {
    const done = statuses.find((s) => s.isDone);
    return done?.slug || statuses[statuses.length - 1].slug;
  }

  const mainBoard = statuses.filter((s) => !s.isBacklog && !s.isDone);
  const nonTrackMain = mainBoard.find((s) => !s.tracksTime);
  const tracks = statuses.find((s) => s.tracksTime);
  return nonTrackMain?.slug || tracks?.slug || mainBoard[0]?.slug || statuses[0].slug;
};

const resolveDefaultStatus = async (workspaceId, { isAdmin = false } = {}) => {
  const statuses = await getWorkspaceStatuses(workspaceId);
  if (statuses.length === 0) {
    return isAdmin ? 'backlog' : 'to do';
  }
  if (isAdmin) {
    const backlog = statuses.find((s) => s.isBacklog);
    return backlog ? backlog.slug : statuses[0].slug;
  }
  const main = statuses.find((s) => !s.isBacklog);
  return main ? main.slug : statuses[0].slug;
};

const applyStatusLifecycleUpdate = async ({
  workspaceId,
  oldStatus,
  newStatus,
  oldTicket,
  updateData,
  now = new Date(),
}) => {
  const oldFlags = await getStatusFlags(workspaceId, oldStatus);
  const newFlags = await getStatusFlags(workspaceId, newStatus);

  if (newFlags.tracksTime) {
    updateData.inProgressAt = now;
    if (!newFlags.isDone) {
      updateData.doneAt = null;
    }
  }

  if (oldFlags.tracksTime && oldTicket.inProgressAt) {
    const elapsed = Math.round((now - oldTicket.inProgressAt) / 1000);
    updateData.totalTimeSpent = (oldTicket.totalTimeSpent || 0) + elapsed;
    if (!newFlags.tracksTime) {
      updateData.inProgressAt = null;
    }
  }

  if (newFlags.isDone) {
    updateData.doneAt = now;
  } else if (oldFlags.isDone) {
    updateData.doneAt = null;
  }
};

const assertMainBoardRemains = async (workspaceId, excludeId) => {
  const mainCount = await countMainBoardStatuses(workspaceId, excludeId);
  if (mainCount === 0) {
    throw new StatusValidationError(
      'At least one status must remain on the main board. Turn off Backlog on another status first.'
    );
  }
};

const createStatus = async ({ workspaceId, label, color, isBacklog, tracksTime, isDone }) => {
  const trimmedLabel = validateStatusLabel(label);
  const willBeBacklog = Boolean(isBacklog);
  const willTrackTime = Boolean(tracksTime);
  const willBeDone = Boolean(isDone);

  await assertUniqueLabelInWorkspace(workspaceId, trimmedLabel);
  await assertWorkspaceBehaviorFlags(workspaceId, {
    replaceStatus: {
      isBacklog: willBeBacklog,
      tracksTime: willTrackTime,
      isDone: willBeDone,
    },
  });

  const slug = await generateUniqueSlug(workspaceId, trimmedLabel);
  const maxOrder = await TicketStatus.findOne({ workspace: workspaceId })
    .sort('-sortOrder')
    .select('sortOrder')
    .lean();
  const sortOrder = maxOrder ? maxOrder.sortOrder + 1 : 0;

  try {
    return await TicketStatus.create({
      workspace: workspaceId,
      slug,
      label: trimmedLabel,
      color: color || '#6366f1',
      sortOrder,
      isBacklog: willBeBacklog,
      tracksTime: Boolean(tracksTime),
      isDone: Boolean(isDone),
    });
  } catch (error) {
    throw mapStatusPersistenceError(error);
  }
};

const updateStatus = async (statusId, updates) => {
  const status = await TicketStatus.findById(statusId);
  if (!status) throw new StatusValidationError('Status not found.');

  const nextIsBacklog =
    updates.isBacklog !== undefined ? Boolean(updates.isBacklog) : status.isBacklog;

  if (!status.isBacklog && nextIsBacklog) {
    await assertMainBoardRemains(status.workspace, status._id);
  }

  if (updates.label !== undefined) {
    const trimmedLabel = validateStatusLabel(updates.label);
    await assertUniqueLabelInWorkspace(status.workspace, trimmedLabel, status._id);
    status.label = trimmedLabel;
  }

  if (updates.slug !== undefined) {
    throw new StatusValidationError(
      'Status keys cannot be changed after creation. Add a new status and move tickets instead.'
    );
  }

  if (updates.color !== undefined) status.color = updates.color;
  if (updates.isBacklog !== undefined) status.isBacklog = nextIsBacklog;
  if (updates.tracksTime !== undefined) status.tracksTime = Boolean(updates.tracksTime);
  if (updates.isDone !== undefined) status.isDone = Boolean(updates.isDone);

  await assertWorkspaceBehaviorFlags(status.workspace, {
    replaceStatus: {
      _id: status._id,
      isBacklog: status.isBacklog,
      tracksTime: status.tracksTime,
      isDone: status.isDone,
    },
  });

  try {
    await status.save();
  } catch (error) {
    throw mapStatusPersistenceError(error);
  }

  return status;
};

const deleteStatus = async (statusId) => {
  const status = await TicketStatus.findById(statusId);
  if (!status) throw new StatusValidationError('Status not found.');

  if (!status.isBacklog) {
    await assertMainBoardRemains(status.workspace, status._id);
  }

  await assertWorkspaceBehaviorFlags(status.workspace, { omitStatusId: status._id });

  const ticketCount = await Ticket.countDocuments({
    workspace: status.workspace,
    status: status._id,
  });
  if (ticketCount > 0) {
    const ticketWord = ticketCount === 1 ? 'ticket' : 'tickets';
    throw new StatusValidationError(
      `Cannot delete "${status.label}" because ${ticketCount} ${ticketWord} still use this status. Reassign those tickets first.`
    );
  }

  await TicketStatus.findByIdAndDelete(statusId);
  return { message: 'Status deleted' };
};

const reorderStatuses = async (workspaceId, orderedIds) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new StatusValidationError('Status order is required.');
  }

  const statuses = await TicketStatus.find({ workspace: workspaceId });
  const statusMap = new Map(statuses.map((s) => [s._id.toString(), s]));

  if (orderedIds.length !== statuses.length) {
    throw new StatusValidationError(
      'Status order must include every status in this workspace exactly once.'
    );
  }

  const updates = orderedIds.map((id, index) => {
    const doc = statusMap.get(String(id));
    if (!doc) {
      throw new StatusValidationError('One or more statuses in the order list do not belong to this workspace.');
    }
    return TicketStatus.updateOne({ _id: doc._id }, { $set: { sortOrder: index } });
  });

  await Promise.all(updates);
  return getWorkspaceStatuses(workspaceId);
};

const validateIntegrationTargetStatus = async (workspaceId, slug) => {
  if (!slug) return;
  await validateStatusForWorkspace(workspaceId, slug);
};

module.exports = {
  StatusValidationError,
  DEFAULT_STATUSES,
  slugifyLabel,
  generateUniqueSlug,
  seedDefaultStatuses,
  createStatusesForWorkspace,
  validateStatusesPayload,
  getWorkspaceStatuses,
  getStatusBySlug,
  validateStatusForWorkspace,
  getStatusFlags,
  getBacklogSlugs,
  getBacklogStatusIds,
  getStatusIdForSlug,
  resolveStatusSlugFromTicketRef,
  statusIdsMatch,
  getStatusIdSets,
  getStatusSlugSets,
  resolveDefaultStatus,
  resolveIntegrationStatusTargets,
  normalizeIntegrationSettings,
  resolveAutomationTargetStatus,
  applyStatusLifecycleUpdate,
  createStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
  validateIntegrationTargetStatus,
};
