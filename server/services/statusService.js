const mongoose = require('mongoose');
const TicketStatus = require('../models/TicketStatus');
const Ticket = require('../models/Ticket');
const Integration = require('../models/Integration');
const { pickFallbackSlug } = require('../helpers/statusSlugAliases');
const {
  StatusValidationError,
  validateStatusesPayload,
  validateStatusLabel,
  assertWorkspaceBehaviorFlags,
  assertUniqueLabelInWorkspace,
  mapStatusPersistenceError,
  normalizeStatusBehaviorFlags,
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

const isStatusObjectId = (value) => {
  if (value == null || value === '') return false;
  if (value instanceof mongoose.Types.ObjectId) return true;
  const str = String(value);
  return mongoose.Types.ObjectId.isValid(str) && String(new mongoose.Types.ObjectId(str)) === str;
};

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

const resolveStatusForWorkspace = async (workspaceId, statusRef) => {
  if (!workspaceId || statusRef === undefined || statusRef === null || statusRef === '') {
    throw new Error('Invalid status');
  }

  if (isStatusObjectId(statusRef)) {
    const status = await TicketStatus.findOne({ _id: statusRef, workspace: workspaceId }).lean();
    if (!status) {
      throw new Error('Status is not valid for this workspace');
    }
    return status;
  }

  return validateStatusForWorkspace(workspaceId, statusRef);
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
  return statuses.map((s) => s.slug);
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
      `[statusService] No TicketStatus rows for workspace ${workspaceId}; slug sets empty. Run migrateTicketStatuses.js.`
    );
    return { doneSlugs: [], tracksTimeSlugs: [], activeSlugs: [] };
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
      onMergeTargetStatus: '',
      onPROpenTargetStatus: '',
      onMergeTargetStatusId: null,
      onPROpenTargetStatusId: null,
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
    onMergeTargetStatusId: done?._id || null,
    onPROpenTargetStatusId:
      mainBoard.find((s) => !s.tracksTime)?._id ||
      tracks?._id ||
      mainBoard[0]?._id ||
      statuses.find((s) => !s.isBacklog)?._id ||
      statuses[0]?._id ||
      null,
  };
};

const resolveIntegrationStatusDoc = async (workspaceId, settings, role) => {
  const statuses = await getWorkspaceStatuses(workspaceId);
  if (statuses.length === 0) return null;

  const preferredId =
    role === 'done' ? settings.onMergeTargetStatusId : settings.onPROpenTargetStatusId;
  const preferredSlug =
    role === 'done' ? settings.onMergeTargetStatus : settings.onPROpenTargetStatus;

  if (preferredId && isStatusObjectId(preferredId)) {
    const byId = statuses.find((s) => String(s._id) === String(preferredId));
    if (byId) return byId;
  }

  if (preferredSlug) {
    const normalized = slugifyLabel(preferredSlug);
    const bySlug = statuses.find((s) => s.slug === normalized);
    if (bySlug) return bySlug;
  }

  const defaults = await resolveIntegrationStatusTargets(workspaceId);
  const fallbackId =
    role === 'done' ? defaults.onMergeTargetStatusId : defaults.onPROpenTargetStatusId;
  if (fallbackId) {
    const byFallbackId = statuses.find((s) => String(s._id) === String(fallbackId));
    if (byFallbackId) return byFallbackId;
  }

  const fallbackSlug =
    role === 'done' ? defaults.onMergeTargetStatus : defaults.onPROpenTargetStatus;
  if (fallbackSlug) {
    const byFallbackSlug = statuses.find((s) => s.slug === slugifyLabel(fallbackSlug));
    if (byFallbackSlug) return byFallbackSlug;
  }

  return null;
};

const normalizeIntegrationSettings = async (workspaceId, settings = {}) => {
  const defaults = await resolveIntegrationStatusTargets(workspaceId);
  const statuses = await getWorkspaceStatuses(workspaceId);
  const validSlugs = new Set(statuses.map((s) => s.slug));
  const statusById = new Map(statuses.map((s) => [String(s._id), s]));

  const mergeDoc = await resolveIntegrationStatusDoc(workspaceId, settings, 'done');
  const prOpenDoc = await resolveIntegrationStatusDoc(workspaceId, settings, 'prOpen');

  const mergeSlug = mergeDoc?.slug || defaults.onMergeTargetStatus;
  const prOpenSlug = prOpenDoc?.slug || defaults.onPROpenTargetStatus;

  const mergeSlugValid = mergeSlug && validSlugs.has(slugifyLabel(mergeSlug));
  const prOpenSlugValid = prOpenSlug && validSlugs.has(slugifyLabel(prOpenSlug));

  const mergeId =
    mergeDoc?._id ||
    (settings.onMergeTargetStatusId && statusById.get(String(settings.onMergeTargetStatusId))?._id) ||
    defaults.onMergeTargetStatusId;
  const prOpenId =
    prOpenDoc?._id ||
    (settings.onPROpenTargetStatusId &&
      statusById.get(String(settings.onPROpenTargetStatusId))?._id) ||
    defaults.onPROpenTargetStatusId;

  return {
    autoLinkEnabled: settings.autoLinkEnabled !== false,
    autoMoveOnPROpenEnabled: Boolean(settings.autoMoveOnPROpenEnabled),
    autoMoveOnMergeEnabled: Boolean(settings.autoMoveOnMergeEnabled),
    onMergeTargetStatus: mergeSlugValid ? slugifyLabel(mergeSlug) : defaults.onMergeTargetStatus,
    onPROpenTargetStatus: prOpenSlugValid ? slugifyLabel(prOpenSlug) : defaults.onPROpenTargetStatus,
    onMergeTargetStatusId: mergeId || null,
    onPROpenTargetStatusId: prOpenId || null,
  };
};

const resolveAutomationTargetStatus = async (workspaceId, preferredRef, role) => {
  const statuses = await getWorkspaceStatuses(workspaceId);
  if (statuses.length === 0) {
    throw new StatusValidationError('This workspace has no ticket statuses configured.');
  }

  if (preferredRef) {
    try {
      const match = await resolveStatusForWorkspace(workspaceId, preferredRef);
      return match.slug;
    } catch {
      // fall through to role defaults
    }
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
    throw new StatusValidationError('This workspace has no ticket statuses configured.');
  }
  if (isAdmin) {
    const backlog = statuses.find((s) => s.isBacklog);
    return backlog || statuses[0];
  }
  const main = statuses.find((s) => !s.isBacklog);
  return main || statuses[0];
};

const getStatusLabelFromRef = async (statusRef) => {
  if (!statusRef) return 'Unknown';
  if (typeof statusRef === 'object' && statusRef.label) {
    return statusRef.label;
  }
  const doc = await TicketStatus.findById(statusRef).select('label').lean();
  return doc?.label || 'Unknown';
};

const clearIntegrationStatusReferences = async (workspaceId, statusId) => {
  const integration = await Integration.findOne({ workspace: workspaceId });
  if (!integration?.settings) return;

  const settings = integration.settings;
  const repairs = {};
  const statusIdStr = String(statusId);

  if (settings.onMergeTargetStatusId && String(settings.onMergeTargetStatusId) === statusIdStr) {
    repairs.onMergeTargetStatusId = null;
    repairs.onMergeTargetStatus = '';
  }
  if (settings.onPROpenTargetStatusId && String(settings.onPROpenTargetStatusId) === statusIdStr) {
    repairs.onPROpenTargetStatusId = null;
    repairs.onPROpenTargetStatus = '';
  }

  if (Object.keys(repairs).length === 0) return;

  integration.settings = { ...settings, ...repairs };
  await integration.save();
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

const syncIntegrationStatusSlugs = async (workspaceId, oldSlug, newSlug, statusId = null) => {
  const normalizedOld = slugifyLabel(oldSlug);
  const normalizedNew = slugifyLabel(newSlug);
  if (!normalizedOld || !normalizedNew || normalizedOld === normalizedNew) return;

  const integration = await Integration.findOne({ workspace: workspaceId });
  if (!integration?.settings) return;

  const settings = integration.settings;
  const repairs = {};
  const statusIdStr = statusId ? String(statusId) : null;

  if (slugifyLabel(settings.onMergeTargetStatus) === normalizedOld) {
    repairs.onMergeTargetStatus = normalizedNew;
    if (statusIdStr) repairs.onMergeTargetStatusId = statusId;
  }
  if (slugifyLabel(settings.onPROpenTargetStatus) === normalizedOld) {
    repairs.onPROpenTargetStatus = normalizedNew;
    if (statusIdStr) repairs.onPROpenTargetStatusId = statusId;
  }

  if (Object.keys(repairs).length === 0) return;

  integration.settings = { ...settings, ...repairs };
  await integration.save();
};

const EXCLUSIVE_BEHAVIOR_FLAGS = ['isBacklog', 'tracksTime', 'isDone'];

const clearExclusiveBehaviorFlags = async (workspaceId, flagKey, exceptStatusId = null) => {
  const query = { workspace: workspaceId, [flagKey]: true };
  if (exceptStatusId) {
    query._id = { $ne: exceptStatusId };
  }
  await TicketStatus.updateMany(query, { $set: { [flagKey]: false } });
};

const transferExclusiveBehaviorFlags = async (workspaceId, statusId, flags) => {
  for (const flagKey of EXCLUSIVE_BEHAVIOR_FLAGS) {
    if (flags[flagKey]) {
      await clearExclusiveBehaviorFlags(workspaceId, flagKey, statusId);
    }
  }
};

const applyStatusSlugChange = async (status, nextSlug) => {
  const normalized = slugifyLabel(nextSlug);
  if (!normalized) {
    throw new StatusValidationError('Status key is required.');
  }

  if (normalized === status.slug) return false;

  const duplicate = await TicketStatus.exists({
    workspace: status.workspace,
    slug: normalized,
    _id: { $ne: status._id },
  });
  if (duplicate) {
    throw new StatusValidationError(
      `Another status already uses the key "${normalized}". Choose a different name.`
    );
  }

  const oldSlug = status.slug;
  status.slug = normalized;
  await syncIntegrationStatusSlugs(status.workspace, oldSlug, normalized, status._id);
  return true;
};

const createStatus = async ({ workspaceId, label, color, isBacklog, tracksTime, isDone }) => {
  const trimmedLabel = validateStatusLabel(label);
  const behaviorFlags = normalizeStatusBehaviorFlags({ isBacklog, tracksTime, isDone });

  await assertUniqueLabelInWorkspace(workspaceId, trimmedLabel);

  await transferExclusiveBehaviorFlags(workspaceId, null, behaviorFlags);

  await assertWorkspaceBehaviorFlags(workspaceId, {
    replaceStatus: behaviorFlags,
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
      isBacklog: behaviorFlags.isBacklog,
      tracksTime: behaviorFlags.tracksTime,
      isDone: behaviorFlags.isDone,
    });
  } catch (error) {
    throw mapStatusPersistenceError(error);
  }
};

const applyBehaviorFlagsToStatusDoc = (status, updates = {}) => {
  const merged = normalizeStatusBehaviorFlags({
    isBacklog: updates.isBacklog !== undefined ? updates.isBacklog : status.isBacklog,
    tracksTime: updates.tracksTime !== undefined ? updates.tracksTime : status.tracksTime,
    isDone: updates.isDone !== undefined ? updates.isDone : status.isDone,
  });
  status.isBacklog = merged.isBacklog;
  status.tracksTime = merged.tracksTime;
  status.isDone = merged.isDone;
  return status;
};

const updateStatus = async (statusId, updates) => {
  const status = await TicketStatus.findById(statusId);
  if (!status) throw new StatusValidationError('Status not found.');

  const previousIsBacklog = status.isBacklog;

  if (updates.label !== undefined) {
    const trimmedLabel = validateStatusLabel(updates.label);
    await assertUniqueLabelInWorkspace(status.workspace, trimmedLabel, status._id);
    const labelChanged = trimmedLabel !== status.label;
    status.label = trimmedLabel;

    if (labelChanged) {
      const nextSlug = await generateUniqueSlug(status.workspace, trimmedLabel, status._id);
      await applyStatusSlugChange(status, nextSlug);
    }
  }

  if (updates.slug !== undefined) {
    await applyStatusSlugChange(status, updates.slug);
  }

  if (updates.color !== undefined) status.color = updates.color;

  const flagsTouched =
    updates.isBacklog !== undefined ||
    updates.tracksTime !== undefined ||
    updates.isDone !== undefined;

  if (flagsTouched) {
    applyBehaviorFlagsToStatusDoc(status, updates);

    if (!previousIsBacklog && status.isBacklog) {
      await assertMainBoardRemains(status.workspace, status._id);
    }

    await transferExclusiveBehaviorFlags(status.workspace, status._id, {
      isBacklog: status.isBacklog,
      tracksTime: status.tracksTime,
      isDone: status.isDone,
    });
  }

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

const deleteStatus = async (statusId, { reassignToStatusId } = {}) => {
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
    if (!reassignToStatusId) {
      const ticketWord = ticketCount === 1 ? 'ticket' : 'tickets';
      throw new StatusValidationError(
        `Cannot delete "${status.label}" because ${ticketCount} ${ticketWord} still use this status. Choose another status to move them to.`
      );
    }

    if (String(reassignToStatusId) === String(status._id)) {
      throw new StatusValidationError('Reassign target must be a different status.');
    }

    const target = await TicketStatus.findOne({
      _id: reassignToStatusId,
      workspace: status.workspace,
    });

    if (!target) {
      throw new StatusValidationError('Reassign target status is not valid for this workspace.');
    }

    await Ticket.updateMany(
      { workspace: status.workspace, status: status._id },
      { $set: { status: target._id } }
    );
  }

  await clearIntegrationStatusReferences(status.workspace, status._id);
  await TicketStatus.findByIdAndDelete(statusId);
  return { message: 'Status deleted', reassignedTickets: ticketCount };
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

const validateIntegrationTargetStatus = async (workspaceId, statusRef) => {
  if (!statusRef) return;
  await resolveStatusForWorkspace(workspaceId, statusRef);
};

module.exports = {
  StatusValidationError,
  DEFAULT_STATUSES,
  slugifyLabel,
  isStatusObjectId,
  generateUniqueSlug,
  seedDefaultStatuses,
  createStatusesForWorkspace,
  validateStatusesPayload,
  getWorkspaceStatuses,
  getStatusBySlug,
  validateStatusForWorkspace,
  resolveStatusForWorkspace,
  getStatusLabelFromRef,
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
