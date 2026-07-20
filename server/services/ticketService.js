const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const Workspace = require('../models/Workspace');
const mongoose = require('mongoose');
const { notifyTicketAssigned } = require('./notificationService');
const historyService = require('./historyService');
const statusService = require('./statusService');
const { emitTicketEvent, toSocketId } = require('../socket/events');
const { sanitizeDescriptionHtml } = require('../helpers/htmlSanitize');

const PRIORITY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const parseCsvList = (raw = '', { lowercase = false } = {}) => {
  const source = Array.isArray(raw) ? raw.join(',') : String(raw || '');
  const values = source
    .split(',')
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .map((v) => (lowercase ? v.toLowerCase() : v));

  return [...new Set(values)];
};

const normalizePriorityList = ({ priorities, priority }) => {
  const parsed = parseCsvList(priorities, { lowercase: true });
  if (parsed.length > 0) return parsed;

  const legacy = String(priority || '')
    .trim()
    .toLowerCase();
  if (!legacy || legacy === 'all') return [];

  return [legacy];
};

const normalizePriorityOrder = (value) => {
  const safe = String(value || '')
    .trim()
    .toLowerCase();
  if (safe === 'asc' || safe === 'desc') return safe;
  return 'none';
};

const INVALID_ASSIGNEE_ERROR = 'Assigned users must be active members of this workspace';

const extractUserId = (value) => {
  if (!value) return null;

  if (typeof value === 'string') return value;

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'object') {
    if (value._id) return extractUserId(value._id);
    if (value.id) return String(value.id);
  }

  return null;
};

const normalizeAssignedUserIds = (assignedTo = []) => {
  const rawIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
  return [...new Set(rawIds.map(extractUserId).filter(Boolean))];
};

const getNewAssigneeIds = ({ previousAssignedTo = [], nextAssignedTo = [] }) => {
  const previousSet = new Set(normalizeAssignedUserIds(previousAssignedTo));
  return normalizeAssignedUserIds(nextAssignedTo).filter((userId) => !previousSet.has(userId));
};

const parseOptionalDueDate = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
};

const SUBJECT_PREFIX_RE = /^\s*(?:ticket\s*\d+|t\s*#?\s*\d+)\s*[:\-]\s*/i;

const sanitizeTicketSubject = (value) =>
  String(value || '')
    .replace(SUBJECT_PREFIX_RE, '')
    .trim();

const ALLOWED_TICKET_SORT_FIELDS = new Set(['updatedAt', 'dueDate', 'taskNumber']);
const ALLOWED_PERIOD_DAYS = new Set([7, 30]);
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const normalizePeriodDays = (value) => {
  const parsed = Number.parseInt(value, 10);
  return ALLOWED_PERIOD_DAYS.has(parsed) ? parsed : null;
};

const applyCreatedAtPeriodFilter = (query, periodDays) => {
  const days = normalizePeriodDays(periodDays);
  if (!days) return;
  query.createdAt = { $gte: new Date(Date.now() - days * ONE_DAY_MS) };
};

const STATUS_POPULATE_SELECT = 'slug label color isBacklog tracksTime isDone sortOrder';

const TICKET_SOCKET_EVENTS = {
  created: 'ticket:created',
  updated: 'ticket:updated',
  archived: 'ticket:archived',
  unarchived: 'ticket:unarchived',
  moved: 'ticket:moved',
  assigned: 'ticket:assigned',
};

const emitTicketWorkspaceEvent = ({ eventName, ticket, workspaceId, extra = {} }) => {
  const ticketId = toSocketId(ticket?._id || ticket?.id);
  const resolvedWorkspaceId = toSocketId(workspaceId || ticket?.workspace);

  if (!ticketId || !resolvedWorkspaceId) return;

  emitTicketEvent({
    eventName,
    ticketId,
    workspaceId: resolvedWorkspaceId,
    extra: {
      ticket: buildTicketPayload(ticket),
      ...extra,
    },
  });
};

const buildTicketPayload = (ticket) => {
  if (!ticket) return null;
  const source = typeof ticket.toObject === 'function' ? ticket.toObject() : ticket;

  return {
    ...source,
    _id: toSocketId(source._id || source.id),
    workspace: toSocketId(source.workspace),
    status: buildStatusPayload(source.status),
    creator:
      source.creator && typeof source.creator === 'object'
        ? {
            ...source.creator,
            _id: toSocketId(source.creator._id || source.creator.id),
          }
        : source.creator,
    assignedTo: Array.isArray(source.assignedTo)
      ? source.assignedTo.map((assignee) =>
          assignee && typeof assignee === 'object'
            ? {
                ...assignee,
                _id: toSocketId(assignee._id || assignee.id),
              }
            : assignee
        )
      : source.assignedTo,
  };
};

const buildStatusPayload = (statusRef) => {
  if (!statusRef) return null;

  if (typeof statusRef.toObject === 'function') {
    const status = statusRef.toObject();
    return {
      ...status,
      _id: toSocketId(status._id),
    };
  }

  if (typeof statusRef === 'object') {
    return {
      ...statusRef,
      _id: toSocketId(statusRef._id || statusRef.id),
    };
  }

  return null;
};

const statusLookupStages = () => [
  {
    $lookup: {
      from: 'ticketstatuses',
      localField: 'status',
      foreignField: '_id',
      as: 'status',
      pipeline: [
        {
          $project: {
            slug: 1,
            label: 1,
            color: 1,
            isBacklog: 1,
            tracksTime: 1,
            isDone: 1,
            sortOrder: 1,
          },
        },
      ],
    },
  },
  { $unwind: { path: '$status', preserveNullAndEmptyArrays: true } },
];

/** Aggregate $match does not cast strings to ObjectIds — align with find()/countDocuments(). */
const castTicketQueryForAggregate = (query) => {
  const mongooseQuery = Ticket.find(query);
  mongooseQuery.cast(Ticket);
  return mongooseQuery.getFilter();
};

const buildTicketListSort = (sortBy = 'dueDate', sortOrder = 'desc') => {
  const field = ALLOWED_TICKET_SORT_FIELDS.has(sortBy) ? sortBy : 'dueDate';
  const dir = sortOrder === 'asc' ? 1 : -1;
  if (field === 'dueDate') {
    return { dueDate: dir, updatedAt: -1 };
  }
  if (field === 'taskNumber') {
    return { taskNumber: dir, updatedAt: -1 };
  }
  return { updatedAt: dir };
};

const ensureAssignableUsersBelongToWorkspace = async ({ workspaceId, assignedTo = [] }) => {
  const assignedUserIds = normalizeAssignedUserIds(assignedTo);
  if (!workspaceId || assignedUserIds.length === 0) return;

  const workspace = await Workspace.findById(workspaceId).select('members.user members.status');
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const activeMemberIds = new Set(
    workspace.members
      .filter((member) => member.status === 'active' && member.user)
      .map((member) => member.user.toString())
  );

  const hasInvalidAssignee = assignedUserIds.some((userId) => !activeMemberIds.has(userId));
  if (hasInvalidAssignee) {
    throw new Error(INVALID_ASSIGNEE_ERROR);
  }
};

const getAllTickets = async ({
  page = 1,
  limit = 10,
  search = '',
  status = '',
  statusId = '',
  priority = '',
  priorities = '',
  assigneeIds = '',
  priorityOrder = 'none',
  archived,
  workspaceId,
  sortBy,
  sortOrder,
  periodDays,
}) => {
  if (!workspaceId) {
    return {
      tickets: [],
      pagination: {
        total: 0,
        page: Number(page),
        limit: Number(limit),
        pages: 0,
      },
    };
  }

  const safeLimit = Number(limit) || 10;
  const safePage = Number(page) || 1;
  const skip = (safePage - 1) * safeLimit;

  const query = { workspace: workspaceId };

  if (archived !== undefined) {
    query.isArchived = archived ? true : { $ne: true };
  }

  applyCreatedAtPeriodFilter(query, periodDays);

  if (search) {
    const searchConditions = [
      { subject: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];

    const searchAsNumber = Number(search);
    if (!Number.isNaN(searchAsNumber)) {
      searchConditions.push({ taskNumber: searchAsNumber });
    }

    query.$or = searchConditions;
  }

  if (status === 'null' || status === null) {
    query.status = null;
  } else if (status === 'not_null') {
    const backlogIds = await statusService.getBacklogStatusIds(workspaceId);
    if (backlogIds.length > 0) {
      query.status = { $nin: backlogIds };
    }
  } else if (statusId) {
    const statusDoc = await statusService.resolveStatusForWorkspace(workspaceId, statusId);
    query.status = statusDoc._id;
  } else if (status && status !== 'all') {
    query.status = await statusService.getStatusIdForSlug(workspaceId, status);
  }

  const selectedPriorities = normalizePriorityList({ priorities, priority });
  if (selectedPriorities.length > 0) {
    query.priority = { $in: selectedPriorities };
  }

  const selectedAssigneeIds = parseCsvList(assigneeIds, { lowercase: false });
  if (selectedAssigneeIds.length > 0) {
    const wantsUnassigned = selectedAssigneeIds.includes('unassigned');
    const selectedUsers = selectedAssigneeIds.filter((id) => id !== 'unassigned');

    const selectedUserObjectIds = selectedUsers
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const assigneeOr = [];

    if (selectedUserObjectIds.length > 0) {
      assigneeOr.push({ assignedTo: { $in: selectedUserObjectIds } });
    }

    if (wantsUnassigned) {
      assigneeOr.push({ assignedTo: { $exists: false } }, { assignedTo: { $size: 0 } });
    }

    if (assigneeOr.length === 1) {
      Object.assign(query, assigneeOr[0]);
    } else if (assigneeOr.length > 1) {
      query.$and = query.$and || [];
      query.$and.push({ $or: assigneeOr });
    }
  }

  const normalizedOrder = normalizePriorityOrder(priorityOrder);

  let tickets;
  let total;

  if (normalizedOrder === 'none') {
    const sortSpec = buildTicketListSort(sortBy, sortOrder);
    [tickets, total] = await Promise.all([
      Ticket.find(query)
        .sort(sortSpec)
        .skip(skip)
        .limit(safeLimit)
        .populate('status', STATUS_POPULATE_SELECT)
        .populate('creator', 'fullname email')
        .populate('assignedTo', 'fullname email role')
        .populate('category'),
      Ticket.countDocuments(query),
    ]);
  } else {
    const mongoSort = {
      priorityRank: normalizedOrder === 'desc' ? -1 : 1,
      updatedAt: -1,
    };

    const aggregateMatch = castTicketQueryForAggregate(query);

    [tickets, total] = await Promise.all([
      Ticket.aggregate([
        { $match: aggregateMatch },
        {
          $addFields: {
            priorityRank: {
              $switch: {
                branches: [
                  { case: { $eq: ['$priority', 'low'] }, then: PRIORITY_RANK.low },
                  { case: { $eq: ['$priority', 'medium'] }, then: PRIORITY_RANK.medium },
                  { case: { $eq: ['$priority', 'high'] }, then: PRIORITY_RANK.high },
                  { case: { $eq: ['$priority', 'critical'] }, then: PRIORITY_RANK.critical },
                ],
                default: PRIORITY_RANK.medium,
              },
            },
          },
        },
        { $sort: mongoSort },
        { $skip: skip },
        { $limit: safeLimit },
        {
          $lookup: {
            from: 'users',
            localField: 'creator',
            foreignField: '_id',
            as: 'creator',
            pipeline: [{ $project: { fullname: 1, email: 1 } }],
          },
        },
        { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'assignedTo',
            pipeline: [{ $project: { fullname: 1, email: 1, role: 1 } }],
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        ...statusLookupStages(),
        { $project: { priorityRank: 0 } },
      ]),
      Ticket.countDocuments(query),
    ]);
  }

  return {
    tickets,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

const getTicketById = async (ticketId) => {
  const ticket = await Ticket.findById(ticketId)
    .populate('status', STATUS_POPULATE_SELECT)
    .populate('assignedTo', 'fullname email role')
    .populate('creator', 'fullname email')
    .populate('category');

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  return ticket;
};

const createTicket = async (ticketData) => {
  await ensureAssignableUsersBelongToWorkspace({
    workspaceId: ticketData.workspaceId,
    assignedTo: ticketData.assignedTo,
  });

  const lastTicket = await Ticket.findOne({ workspace: ticketData.workspaceId })
    .sort('-taskNumber')
    .select('taskNumber')
    .lean();

  const nextTaskNumber = lastTicket && lastTicket.taskNumber ? lastTicket.taskNumber + 1 : 1;

  let statusDoc;
  if (ticketData.statusId) {
    statusDoc = await statusService.resolveStatusForWorkspace(
      ticketData.workspaceId,
      ticketData.statusId
    );
  } else if (
    ticketData.status !== undefined &&
    ticketData.status !== null &&
    ticketData.status !== ''
  ) {
    statusDoc = await statusService.resolveStatusForWorkspace(
      ticketData.workspaceId,
      ticketData.status
    );
  } else {
    statusDoc = await statusService.resolveDefaultStatus(ticketData.workspaceId, {
      isAdmin: Boolean(ticketData.isAdmin),
    });
  }
  const statusId = statusDoc._id;

  const statusFlags = await statusService.getStatusFlags(ticketData.workspaceId, statusDoc.slug);

  const dueDate = parseOptionalDueDate(ticketData.dueDate);

  const sanitizedSubject = sanitizeTicketSubject(ticketData.subject);
  if (!sanitizedSubject) {
    throw new Error('Subject details are required');
  }

  const ticket = new Ticket({
    subject: sanitizedSubject,
    description: sanitizeDescriptionHtml(ticketData.description),
    creator: ticketData.creatorId,
    status: statusId,
    priority: ticketData.priority || 'medium',
    storyPoints: ticketData.storyPoints ?? null,
    assignedTo: ticketData.assignedTo,
    workspace: ticketData.workspaceId,
    taskNumber: nextTaskNumber,
    category: ticketData.category || null,
    inProgressAt: statusFlags.tracksTime ? new Date() : undefined,
    doneAt: statusFlags.isDone ? new Date() : undefined,
    ...(dueDate !== undefined ? { dueDate } : {}),
  });

  await ticket.save();

  historyService.logEvent(ticket._id, ticketData.creatorId, 'Ticket Created');

  const newlyAssignedUserIds = normalizeAssignedUserIds(ticketData.assignedTo);
  if (newlyAssignedUserIds.length > 0) {
    await notifyTicketAssigned({
      ticket,
      assignedUserIds: newlyAssignedUserIds,
      actorUserId: ticketData.actorUserId || ticketData.creatorId,
    });
  }

  const populatedTicket = await ticket.populate([
    { path: 'status', select: STATUS_POPULATE_SELECT },
    { path: 'creator', select: 'fullName email' },
    { path: 'assignedTo', select: 'fullName email' },
  ]);

  emitTicketWorkspaceEvent({
    eventName: TICKET_SOCKET_EVENTS.created,
    ticket: populatedTicket,
    workspaceId: ticketData.workspaceId,
  });

  if (newlyAssignedUserIds.length > 0) {
    emitTicketWorkspaceEvent({
      eventName: TICKET_SOCKET_EVENTS.assigned,
      ticket: populatedTicket,
      workspaceId: ticketData.workspaceId,
      extra: { assignedUserIds: newlyAssignedUserIds.map(String) },
    });
  }

  return populatedTicket;
};

const updateTicket = async (ticketId, updateData, actorUserId) => {
  try {
    const requestedUpdateKeys = Object.keys(updateData);
    const isStatusOnlyRequest =
      requestedUpdateKeys.length > 0 &&
      requestedUpdateKeys.every((key) => key === 'status' || key === 'statusId');

    if (Object.prototype.hasOwnProperty.call(updateData, 'subject')) {
      const sanitizedSubject = sanitizeTicketSubject(updateData.subject);
      if (!sanitizedSubject) {
        throw new Error('Subject details are required');
      }
      updateData.subject = sanitizedSubject;
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'description')) {
      updateData.description = sanitizeDescriptionHtml(updateData.description);
    }

    const oldTicket = await Ticket.findById(ticketId);
    if (!oldTicket) throw new Error('Ticket not found');

    const previousAssignedTo = oldTicket.assignedTo || [];
    let statusChanged = false;
    let assigneesChanged = false;
    let newlyAssignedUserIds = [];

    if (Object.prototype.hasOwnProperty.call(updateData, 'assignedTo')) {
      await ensureAssignableUsersBelongToWorkspace({
        workspaceId: oldTicket.workspace,
        assignedTo: updateData.assignedTo,
      });
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'dueDate')) {
      const raw = updateData.dueDate;
      if (raw === null || raw === '') {
        updateData.dueDate = null;
      } else {
        const parsed = parseOptionalDueDate(raw);
        if (parsed === undefined) {
          delete updateData.dueDate;
        } else {
          updateData.dueDate = parsed;
        }
      }
    }

    const statusInput = updateData.statusId ?? updateData.status;
    if (statusInput) {
      const statusDoc = await statusService.resolveStatusForWorkspace(
        oldTicket.workspace,
        statusInput
      );
      const newStatusSlug = statusDoc.slug;
      const oldStatusSlug = await statusService.resolveStatusSlugFromTicketRef(oldTicket.status);

      if (!statusService.statusIdsMatch(oldTicket.status, statusDoc._id)) {
        statusChanged = true;
        const oldFlags = await statusService.getStatusFlags(oldTicket.workspace, oldStatusSlug);
        if (statusDoc.isBacklog && !oldFlags.isBacklog) {
          throw new Error('Tickets cannot be moved back to the backlog.');
        }

        const now = new Date();
        const oldLabel = await statusService.getStatusLabelFromRef(oldTicket.status);
        const newLabel = statusDoc.label;

        updateData.status = statusDoc._id;
        delete updateData.statusId;

        await statusService.applyStatusLifecycleUpdate({
          workspaceId: oldTicket.workspace,
          oldStatus: oldStatusSlug,
          newStatus: newStatusSlug,
          oldTicket,
          updateData,
          now,
        });

        historyService.logEvent(
          ticketId,
          actorUserId,
          `Status changed from "${oldLabel}" to "${newLabel}"`
        );
      } else {
        delete updateData.status;
        delete updateData.statusId;
      }
    }

    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { $set: updateData },
      {
        returnDocument: 'after',
        runValidators: true,
      }
    )
      .populate('status', STATUS_POPULATE_SELECT)
      .populate('assignedTo', 'fullname email role')
      .populate('creator', 'fullName');

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'assignedTo')) {
      newlyAssignedUserIds = getNewAssigneeIds({
        previousAssignedTo,
        nextAssignedTo: ticket.assignedTo || [],
      });

      const prevIds = normalizeAssignedUserIds(previousAssignedTo).sort();
      const nextIds = normalizeAssignedUserIds(updateData.assignedTo).sort();
      assigneesChanged = JSON.stringify(prevIds) !== JSON.stringify(nextIds);

      if (assigneesChanged) {
        const currentAssignees = ticket.assignedTo || [];
        if (newlyAssignedUserIds.length > 0) {
          await notifyTicketAssigned({
            ticket,
            assignedUserIds: newlyAssignedUserIds,
            actorUserId,
          });
          const newlyAssignedNames = currentAssignees
            .filter((u) => newlyAssignedUserIds.some((id) => id.toString() === u._id.toString()))
            .map((u) => u.fullname)
            .join(', ');
          historyService.logEvent(ticketId, actorUserId, `Assigned to ${newlyAssignedNames}`);
        } else if (currentAssignees.length === 0) {
          historyService.logEvent(ticketId, actorUserId, 'All assignees removed');
        } else {
          const names = currentAssignees.map((u) => u.fullname).join(', ');
          historyService.logEvent(ticketId, actorUserId, `Reassigned to ${names}`);
        }
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(updateData, 'description') &&
      updateData.description !== oldTicket.description
    ) {
      historyService.logEvent(ticketId, actorUserId, 'Description Updated');
    }

    if (
      Object.prototype.hasOwnProperty.call(updateData, 'subject') &&
      updateData.subject !== oldTicket.subject
    ) {
      historyService.logEvent(ticketId, actorUserId, 'Subject updated');
    }

    if (
      Object.prototype.hasOwnProperty.call(updateData, 'priority') &&
      updateData.priority !== oldTicket.priority
    ) {
      historyService.logEvent(
        ticketId,
        actorUserId,
        `Priority changed from ${oldTicket.priority} to ${updateData.priority}`
      );
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'storyPoints')) {
      const oldSP = oldTicket.storyPoints ?? null;
      const newSP = updateData.storyPoints ?? null;
      if (oldSP !== newSP) {
        let action;
        if (oldSP === null && newSP !== null) action = `Story points set to ${newSP}`;
        else if (oldSP !== null && newSP === null) action = 'Story points removed';
        else action = `Story points changed from ${oldSP} to ${newSP}`;
        historyService.logEvent(ticketId, actorUserId, action);
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'dueDate')) {
      const oldDate = oldTicket.dueDate ? new Date(oldTicket.dueDate).getTime() : null;
      const newDate = updateData.dueDate ? new Date(updateData.dueDate).getTime() : null;
      if (oldDate !== newDate) {
        let action;
        if (!oldDate && newDate) {
          action = `Due date set to ${new Date(updateData.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else if (oldDate && !newDate) {
          action = 'Due date removed';
        } else {
          action = `Due date changed to ${new Date(updateData.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        historyService.logEvent(ticketId, actorUserId, action);
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'category')) {
      const oldCatId = oldTicket.category?.toString() || null;
      const newCatId = updateData.category?.toString() || null;
      if (oldCatId !== newCatId) {
        const [oldCat, newCat] = await Promise.all([
          oldCatId ? Category.findById(oldCatId).select('name').lean() : null,
          newCatId ? Category.findById(newCatId).select('name').lean() : null,
        ]);
        let action;
        if (!oldCatId && newCatId) action = `Category set to ${newCat?.name || 'Unknown'}`;
        else if (oldCatId && !newCatId) action = 'Category removed';
        else
          action = `Category changed from ${oldCat?.name || 'Unknown'} to ${newCat?.name || 'Unknown'}`;
        historyService.logEvent(ticketId, actorUserId, action);
      }
    }

    if (!isStatusOnlyRequest) {
      emitTicketWorkspaceEvent({
        eventName: TICKET_SOCKET_EVENTS.updated,
        ticket,
        workspaceId: oldTicket.workspace,
      });
    }

    if (statusChanged) {
      emitTicketWorkspaceEvent({
        eventName: TICKET_SOCKET_EVENTS.moved,
        ticket,
        workspaceId: oldTicket.workspace,
        extra: {
          statusId: toSocketId(ticket.status?._id || ticket.status),
          status: buildStatusPayload(ticket.status),
        },
      });
    }

    if (assigneesChanged) {
      emitTicketWorkspaceEvent({
        eventName: TICKET_SOCKET_EVENTS.assigned,
        ticket,
        workspaceId: oldTicket.workspace,
        extra: {
          assignedUserIds: normalizeAssignedUserIds(ticket.assignedTo),
          newlyAssignedUserIds: newlyAssignedUserIds.map(String),
        },
      });
    }

    return ticket;
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new Error(`Validation failed: ${error.message}`);
    }
    throw error;
  }
};

const archiveTicket = async (ticketId, actorUserId) => {
  const ticket = await Ticket.findByIdAndUpdate(
    ticketId,
    { $set: { isArchived: true, archivedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!ticket) {
    throw new Error('Ticket not found');
  }
  historyService.logEvent(ticketId, actorUserId, 'Ticket Archived');
  emitTicketWorkspaceEvent({
    eventName: TICKET_SOCKET_EVENTS.archived,
    ticket,
  });
  return ticket;
};

const unarchiveTicket = async (ticketId, actorUserId) => {
  const ticket = await Ticket.findByIdAndUpdate(
    ticketId,
    { $set: { isArchived: false, archivedAt: null } },
    { returnDocument: 'after' }
  );
  if (!ticket) {
    throw new Error('Ticket not found');
  }
  historyService.logEvent(ticketId, actorUserId, 'Ticket Restored');
  emitTicketWorkspaceEvent({
    eventName: TICKET_SOCKET_EVENTS.unarchived,
    ticket,
  });
  return ticket;
};

const getMyTickets = async ({
  userId,
  workspaceId,
  page = 1,
  limit = 10,
  search = '',
  status = '',
  statusId = '',
  priority = '',
  priorities = '',
  priorityOrder = 'none',
  sortBy,
  sortOrder,
}) => {
  const safeLimit = Number(limit) || 10;
  const safePage = Number(page) || 1;
  const skip = (safePage - 1) * safeLimit;

  if (!workspaceId) {
    return {
      tickets: [],
      pagination: {
        total: 0,
        page: safePage,
        limit: safeLimit,
        pages: 0,
      },
    };
  }

  const query = {
    assignedTo: userId,
    isArchived: { $ne: true },
    workspace: workspaceId,
  };

  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (status === 'not_null') {
    const backlogIds = await statusService.getBacklogStatusIds(workspaceId);
    if (backlogIds.length > 0) {
      query.status = { $nin: backlogIds };
    }
  } else if (statusId) {
    const statusDoc = await statusService.resolveStatusForWorkspace(workspaceId, statusId);
    query.status = statusDoc._id;
  } else if (status && status !== 'all') {
    query.status = await statusService.getStatusIdForSlug(workspaceId, status);
  }

  const selectedPriorities = normalizePriorityList({ priorities, priority });
  if (selectedPriorities.length > 0) {
    query.priority = { $in: selectedPriorities };
  }

  const normalizedOrder = normalizePriorityOrder(priorityOrder);
  const sortStage =
    normalizedOrder === 'none'
      ? null
      : {
          priorityRank: normalizedOrder === 'desc' ? -1 : 1,
          updatedAt: -1,
        };

  const sortSpec = buildTicketListSort(sortBy, sortOrder);

  const ticketsQuery =
    normalizedOrder === 'none'
      ? Ticket.find(query)
          .sort(sortSpec)
          .skip(skip)
          .limit(safeLimit)
          .populate('status', STATUS_POPULATE_SELECT)
          .populate('creator', 'fullname email')
          .populate('assignedTo', 'fullname email role')
          .populate('category')
      : Ticket.aggregate([
          { $match: castTicketQueryForAggregate(query) },
          {
            $addFields: {
              priorityRank: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$priority', 'low'] }, then: PRIORITY_RANK.low },
                    { case: { $eq: ['$priority', 'medium'] }, then: PRIORITY_RANK.medium },
                    { case: { $eq: ['$priority', 'high'] }, then: PRIORITY_RANK.high },
                    { case: { $eq: ['$priority', 'critical'] }, then: PRIORITY_RANK.critical },
                  ],
                  default: PRIORITY_RANK.medium,
                },
              },
            },
          },
          { $sort: sortStage },
          { $skip: skip },
          { $limit: safeLimit },
          {
            $lookup: {
              from: 'users',
              localField: 'creator',
              foreignField: '_id',
              as: 'creator',
              pipeline: [{ $project: { fullname: 1, email: 1 } }],
            },
          },
          { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'users',
              localField: 'assignedTo',
              foreignField: '_id',
              as: 'assignedTo',
              pipeline: [{ $project: { fullname: 1, email: 1, role: 1 } }],
            },
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
            },
          },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          ...statusLookupStages(),
          { $project: { priorityRank: 0 } },
        ]);

  const [tickets, total] = await Promise.all([ticketsQuery, Ticket.countDocuments(query)]);

  return {
    tickets,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

module.exports = {
  getAllTickets,
  createTicket,
  getTicketById,
  updateTicket,
  archiveTicket,
  unarchiveTicket,
  getMyTickets,
  INVALID_ASSIGNEE_ERROR,
};
