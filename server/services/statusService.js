const TaskStatus = require('../models/TaskStatus');
const Ticket = require('../models/Ticket');

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
    const exists = await TaskStatus.exists(query);
    if (!exists) return candidate;
    candidate = `${base} ${suffix}`;
    suffix += 1;
  }
};

const countMainBoardStatuses = async (workspaceId, excludeId = null) => {
  const query = { workspace: workspaceId, isBacklog: false };
  if (excludeId) query._id = { $ne: excludeId };
  return TaskStatus.countDocuments(query);
};

const seedDefaultStatuses = async (workspaceId) => {
  const existing = await TaskStatus.countDocuments({ workspace: workspaceId });
  if (existing > 0) return getWorkspaceStatuses(workspaceId);

  const docs = DEFAULT_STATUSES.map((s, index) => ({
    ...s,
    workspace: workspaceId,
    sortOrder: index,
  }));
  await TaskStatus.insertMany(docs);
  return getWorkspaceStatuses(workspaceId);
};

const createStatusesForWorkspace = async (workspaceId, statusesPayload = []) => {
  const existing = await TaskStatus.countDocuments({ workspace: workspaceId });
  if (existing > 0) {
    return getWorkspaceStatuses(workspaceId);
  }

  if (!Array.isArray(statusesPayload) || statusesPayload.length === 0) {
    return seedDefaultStatuses(workspaceId);
  }

  const docs = [];
  for (let i = 0; i < statusesPayload.length; i += 1) {
    const item = statusesPayload[i];
    const label = String(item.label || '').trim();
    if (!label) continue;

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

  if (docs.length === 0) {
    return seedDefaultStatuses(workspaceId);
  }

  const hasMainBoard = docs.some((d) => !d.isBacklog);
  if (!hasMainBoard) {
    throw new Error('At least one main-board status is required');
  }

  await TaskStatus.insertMany(docs);
  return getWorkspaceStatuses(workspaceId);
};

const getWorkspaceStatuses = async (workspaceId) => {
  return TaskStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean();
};

const getStatusBySlug = async (workspaceId, slug) => {
  return TaskStatus.findOne({ workspace: workspaceId, slug: slugifyLabel(slug) }).lean();
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
  const statuses = await TaskStatus.find({ workspace: workspaceId, isBacklog: true })
    .select('slug')
    .lean();
  if (statuses.length > 0) return statuses.map((s) => s.slug);
  return ['backlog'];
};

const getStatusSlugSets = async (workspaceId) => {
  const statuses = await getWorkspaceStatuses(workspaceId);
  if (statuses.length === 0) {
    return {
      doneSlugs: ['done'],
      tracksTimeSlugs: ['in progress'],
      blockedSlugs: ['blocked'],
      activeSlugs: ['to do', 'in progress', 'on staging', 'blocked'],
      inProgressSlugs: ['in progress', 'on staging'],
    };
  }

  return {
    doneSlugs: statuses.filter((s) => s.isDone).map((s) => s.slug),
    tracksTimeSlugs: statuses.filter((s) => s.tracksTime).map((s) => s.slug),
    blockedSlugs: statuses.filter((s) => s.slug === 'blocked').map((s) => s.slug),
    activeSlugs: statuses.filter((s) => !s.isBacklog && !s.isDone).map((s) => s.slug),
    inProgressSlugs: statuses
      .filter((s) => s.tracksTime || s.slug === 'on staging')
      .map((s) => s.slug),
  };
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

const createStatus = async ({ workspaceId, label, color, isBacklog, tracksTime, isDone }) => {
  const trimmedLabel = String(label || '').trim();
  if (!trimmedLabel) throw new Error('Status label is required');

  const slug = await generateUniqueSlug(workspaceId, trimmedLabel);
  const maxOrder = await TaskStatus.findOne({ workspace: workspaceId })
    .sort('-sortOrder')
    .select('sortOrder')
    .lean();
  const sortOrder = maxOrder ? maxOrder.sortOrder + 1 : 0;

  return TaskStatus.create({
    workspace: workspaceId,
    slug,
    label: trimmedLabel,
    color: color || '#6366f1',
    sortOrder,
    isBacklog: Boolean(isBacklog),
    tracksTime: Boolean(tracksTime),
    isDone: Boolean(isDone),
  });
};

const updateStatus = async (statusId, updates) => {
  const status = await TaskStatus.findById(statusId);
  if (!status) throw new Error('Status not found');

  const nextIsBacklog =
    updates.isBacklog !== undefined ? Boolean(updates.isBacklog) : status.isBacklog;

  if (nextIsBacklog) {
    const mainCount = await countMainBoardStatuses(status.workspace, status._id);
    if (mainCount === 0 && !status.isBacklog) {
      throw new Error('Cannot remove the last main-board status');
    }
  } else if (status.isBacklog && !nextIsBacklog) {
    // ok
  } else if (!nextIsBacklog) {
    // ok
  } else if (nextIsBacklog && !status.isBacklog) {
    const mainCount = await countMainBoardStatuses(status.workspace, status._id);
    if (mainCount === 0) {
      throw new Error('Cannot remove the last main-board status');
    }
  }

  if (updates.label !== undefined) {
    const trimmed = String(updates.label).trim();
    if (!trimmed) throw new Error('Status label is required');
    status.label = trimmed;
  }

  if (updates.slug !== undefined) {
    status.slug = slugifyLabel(updates.slug);
    const duplicate = await TaskStatus.findOne({
      workspace: status.workspace,
      slug: status.slug,
      _id: { $ne: status._id },
    });
    if (duplicate) throw new Error('Status slug already exists in this workspace');
  }

  if (updates.color !== undefined) status.color = updates.color;
  if (updates.isBacklog !== undefined) status.isBacklog = Boolean(updates.isBacklog);
  if (updates.tracksTime !== undefined) status.tracksTime = Boolean(updates.tracksTime);
  if (updates.isDone !== undefined) status.isDone = Boolean(updates.isDone);

  if (status.isBacklog === false && updates.isBacklog === true) {
    const mainCount = await countMainBoardStatuses(status.workspace, status._id);
    if (mainCount === 0) {
      throw new Error('Cannot remove the last main-board status');
    }
  }

  await status.save();
  return status;
};

const deleteStatus = async (statusId) => {
  const status = await TaskStatus.findById(statusId);
  if (!status) throw new Error('Status not found');

  if (!status.isBacklog) {
    const mainCount = await countMainBoardStatuses(status.workspace, status._id);
    if (mainCount === 0) {
      throw new Error('Cannot delete the last main-board status');
    }
  }

  const ticketCount = await Ticket.countDocuments({
    workspace: status.workspace,
    status: status.slug,
  });
  if (ticketCount > 0) {
    throw new Error('Cannot delete a status that is in use by tickets');
  }

  await TaskStatus.findByIdAndDelete(statusId);
  return { message: 'Status deleted' };
};

const reorderStatuses = async (workspaceId, orderedIds) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error('orderedIds is required');
  }

  const statuses = await TaskStatus.find({ workspace: workspaceId });
  const statusMap = new Map(statuses.map((s) => [s._id.toString(), s]));

  const updates = orderedIds.map((id, index) => {
    const doc = statusMap.get(String(id));
    if (!doc) throw new Error('Invalid status id in reorder list');
    return TaskStatus.updateOne({ _id: doc._id }, { $set: { sortOrder: index } });
  });

  await Promise.all(updates);
  return getWorkspaceStatuses(workspaceId);
};

const validateIntegrationTargetStatus = async (workspaceId, slug) => {
  if (!slug) return;
  await validateStatusForWorkspace(workspaceId, slug);
};

module.exports = {
  DEFAULT_STATUSES,
  slugifyLabel,
  generateUniqueSlug,
  seedDefaultStatuses,
  createStatusesForWorkspace,
  getWorkspaceStatuses,
  getStatusBySlug,
  validateStatusForWorkspace,
  getStatusFlags,
  getBacklogSlugs,
  getStatusSlugSets,
  resolveDefaultStatus,
  applyStatusLifecycleUpdate,
  createStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
  validateIntegrationTargetStatus,
};
