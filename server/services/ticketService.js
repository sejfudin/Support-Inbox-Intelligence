const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const Category = require('../models/Category');
const Workspace = require('../models/Workspace');
const mongoose = require('mongoose');
const { notifyTicketAssigned } = require('./notificationService');
const historyService = require('./historyService');
const statusService = require('./statusService');
const { emitTicketEvent, toSocketId } = require('../socket/events');
const { sanitizeDescriptionHtml } = require('../helpers/htmlSanitize');
const { escapeRegex } = require('../helpers/escapeRegex');
const { httpError } = require('../helpers/httpError');
const {
  CIRCULAR_BLOCKER_ERROR,
  DONE_BLOCKER_ERROR,
  INVALID_BLOCKER_ERROR,
  SELF_BLOCKER_ERROR,
  blockerIsDone,
  describeBlockerChange,
  isBlockedStatusSlug,
  parseBlockerInput,
  readBlocker,
  resolveBlockerUpdate,
} = require('../helpers/ticketBlocker');

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
const INVALID_CATEGORY_ERROR = 'Category is not valid for this workspace';

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

// Sorting is a server concern on every list here: the lists are paginated, so
// ordering the 25 rows one page happens to hold is not a sort. Priority is not in
// this set — it ranks through the separate `priorityOrder` parameter, because
// low/medium/high/critical is an order, not an alphabet.
const ALLOWED_TICKET_SORT_FIELDS = new Set([
  'updatedAt',
  'createdAt',
  'dueDate',
  'taskNumber',
  'subject',
  'storyPoints',
  'archivedAt',
]);
const DEFAULT_TICKET_SORT_FIELD = 'dueDate';

const normalizeTicketSortField = (sortBy) =>
  ALLOWED_TICKET_SORT_FIELDS.has(sortBy) ? sortBy : DEFAULT_TICKET_SORT_FIELD;

// Subject is the one text sort. Without a collation Mongo compares raw bytes, so
// every capitalised subject sorts ahead of every lowercase one; strength 2 makes
// the column read the way the user spells it.
const SUBJECT_SORT_COLLATION = { locale: 'en', strength: 2 };

// Tickets archived before `archivedAt` existed have no value for it. Rather than
// migrate them, the archive sort runs through the aggregate path, where `$ifNull`
// falls back to `updatedAt` — archiving is a write, so that timestamp is the
// closest proxy for when it happened, and those rows interleave instead of
// clumping at one end of the list.
const ARCHIVED_AT_SORT_FIELD = 'archivedAtSort';
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

// Enough to render the blocker as a clickable reference (number, subject) and to
// tell the reader whether it is still in their way (status, archived).
const BLOCKER_POPULATE = {
  path: 'blockedBy.ticket',
  select: 'subject taskNumber isArchived status',
  populate: { path: 'status', select: 'slug label color isDone' },
};

// The list variant, deliberately thinner: the board card and the table row show a
// "Blocked by #12" chip and nothing else, so they pay for a number and a tooltip
// per row rather than the blocker's own status document.
const BLOCKER_LIST_POPULATE = {
  path: 'blockedBy.ticket',
  select: 'subject taskNumber',
};

// Aggregate equivalent of BLOCKER_LIST_POPULATE — the priority-ordered list sorts
// in Mongo, and `$match`/`$lookup` know nothing about Mongoose populate. `$ifNull`
// keeps the shape identical to the populate path for a ticket with no blocker,
// instead of leaving the key missing on some rows and null on others.
const blockerLookupStages = () => [
  {
    $lookup: {
      from: 'tickets',
      localField: 'blockedBy.ticket',
      foreignField: '_id',
      as: 'blockedByTicket',
      pipeline: [{ $project: { taskNumber: 1, subject: 1 } }],
    },
  },
  {
    $set: {
      'blockedBy.ticket': { $ifNull: [{ $first: '$blockedByTicket' }, null] },
    },
  },
];

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

// Every branch ends with `_id: -1`. The named keys all tie (`dueDate` is often
// null, `updatedAt` ties across a bulk write), and Mongo's sort is not stable
// for tied keys — so without a unique final key, skip/limit paging can show the
// same ticket on two pages and never show another.
// Takes the field and direction already normalized, so a caller that needs them
// for its own branching resolves them once and passes them on.
const buildTicketListSort = (field = DEFAULT_TICKET_SORT_FIELD, dir = -1) => {
  if (field === 'updatedAt') {
    return { updatedAt: dir, _id: -1 };
  }
  return { [field]: dir, updatedAt: -1, _id: -1 };
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

// Categories are workspace-scoped, so a ticket may only point at one from its
// own workspace — otherwise a caller could attach a foreign category id and
// read that workspace's category name, colour and description template back
// through the populated ticket. Mirrors `resolveStatusForWorkspace`.
const ensureCategoryBelongsToWorkspace = async ({ workspaceId, categoryId }) => {
  if (!categoryId) return;

  if (!workspaceId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new Error(INVALID_CATEGORY_ERROR);
  }

  const category = await Category.findOne({ _id: categoryId, workspace: workspaceId })
    .select('_id')
    .lean();

  if (!category) {
    throw new Error(INVALID_CATEGORY_ERROR);
  }
};

// Follows the chain the candidate blocker itself waits on. Two tickets each
// claiming the other blocks them is not an error the database can catch, and it
// reads as a deadlock nobody put there — so the link is refused at write time.
// The walk is short in practice and bounded by `seen` against pre-existing loops.
const assertNoBlockerCycle = async ({ ticketId, blockerTicketId, workspaceId }) => {
  if (!ticketId) return; // A ticket being created cannot yet be in anyone's chain.

  const target = String(ticketId);
  const seen = new Set();
  let cursor = String(blockerTicketId);

  while (cursor) {
    // The one-hop case (blocking itself) is refused earlier with a clearer
    // message, so anything the walk finds is a genuine multi-ticket loop.
    if (cursor === target) throw httpError(CIRCULAR_BLOCKER_ERROR, 400);
    if (seen.has(cursor)) return;
    seen.add(cursor);

    // Scoped by workspace like every other blocker lookup — a cross-workspace
    // link is already refused before this runs, so this is belt-and-suspenders
    // against ever walking into another tenant's chain.
    const next = await Ticket.findOne({ _id: cursor, workspace: workspaceId })
      .select('blockedBy.ticket')
      .lean();
    cursor = next?.blockedBy?.ticket ? String(next.blockedBy.ticket) : null;
  }
};

// A blocker may only point at a ticket from the same workspace — the same rule
// (and the same reason) as `ensureCategoryBelongsToWorkspace`: without it a
// caller could attach a foreign ticket id and read that workspace's subject and
// task number back through the populated blocker.
const resolveBlockingTicket = async ({
  workspaceId,
  blockerTicketId,
  ticketId,
  previousBlockerId = null,
}) => {
  if (!blockerTicketId) return null;

  if (!workspaceId || !mongoose.Types.ObjectId.isValid(blockerTicketId)) {
    throw httpError(INVALID_BLOCKER_ERROR, 400);
  }

  if (ticketId && String(ticketId) === String(blockerTicketId)) {
    throw httpError(SELF_BLOCKER_ERROR, 400);
  }

  const blocker = await Ticket.findOne({ _id: blockerTicketId, workspace: workspaceId })
    .select('_id taskNumber subject status')
    .populate('status', 'slug label isDone')
    .lean();

  if (!blocker) {
    throw httpError(INVALID_BLOCKER_ERROR, 400);
  }

  // A finished ticket is not something anyone is waiting for, so it cannot be
  // picked as a blocker. Only a *new* link is refused: a blocker that gets
  // finished later leaves the link behind, and refusing it here would turn a
  // rule about that link into a wall in front of every other edit to the ticket.
  const isNewLink = String(previousBlockerId || '') !== String(blocker._id);
  if (isNewLink && blockerIsDone(blocker)) {
    throw httpError(DONE_BLOCKER_ERROR, 400);
  }

  await assertNoBlockerCycle({ ticketId, blockerTicketId: blocker._id, workspaceId });

  return blocker;
};

const ticketRefLabel = (ticket) =>
  ticket?.taskNumber ? `Ticket ${ticket.taskNumber}` : 'another ticket';

/**
 * Adds `commentCount` to a page of tickets so the list can show the count
 * without opening each one. Soft-deleted comments are excluded — the ticket list
 * should agree with what the modal renders.
 *
 * Takes both hydrated documents (the `find()` path) and plain objects (the
 * `aggregate()` path), and always returns plain objects.
 */
const attachCommentCounts = async (tickets = []) => {
  if (!tickets.length) return tickets;

  const ids = tickets.map((ticket) => ticket._id).filter(Boolean);
  if (!ids.length) return tickets;

  const counts = await Comment.aggregate([
    { $match: { ticket: { $in: ids }, isDeleted: { $ne: true } } },
    { $group: { _id: '$ticket', count: { $sum: 1 } } },
  ]);

  const countByTicket = new Map(counts.map((row) => [String(row._id), row.count]));

  return tickets.map((ticket) => {
    const plain = typeof ticket.toObject === 'function' ? ticket.toObject() : ticket;
    return { ...plain, commentCount: countByTicket.get(String(plain._id)) || 0 };
  });
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
    const escapedSearch = escapeRegex(search);
    const searchConditions = [
      { subject: { $regex: escapedSearch, $options: 'i' } },
      { description: { $regex: escapedSearch, $options: 'i' } },
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
  const sortField = normalizeTicketSortField(sortBy);
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  // `priorityOrder` and `sortBy` are alternative orders for the same list, and
  // `priorityOrder` is the explicit one, so it wins when a caller sends both.
  const ranksByPriority = normalizedOrder !== 'none';
  const sortsByArchivedAt = !ranksByPriority && sortField === 'archivedAt';

  let tickets;
  let total;

  if (!ranksByPriority && !sortsByArchivedAt) {
    const sortSpec = buildTicketListSort(sortField, sortDirection);
    const listQuery = Ticket.find(query)
      .sort(sortSpec)
      .skip(skip)
      .limit(safeLimit)
      .populate('status', STATUS_POPULATE_SELECT)
      .populate('creator', 'fullname email')
      .populate('assignedTo', 'fullname email role')
      .populate('category')
      .populate(BLOCKER_LIST_POPULATE);

    if (sortField === 'subject') {
      listQuery.collation(SUBJECT_SORT_COLLATION);
    }

    [tickets, total] = await Promise.all([listQuery, Ticket.countDocuments(query)]);
  } else {
    const mongoSort = ranksByPriority
      ? {
          priorityRank: normalizedOrder === 'desc' ? -1 : 1,
          updatedAt: -1,
          _id: -1, // unique tiebreaker — see buildTicketListSort
        }
      : {
          [ARCHIVED_AT_SORT_FIELD]: sortDirection,
          updatedAt: -1,
          _id: -1, // unique tiebreaker — see buildTicketListSort
        };

    const computedSortFields = ranksByPriority
      ? {
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
        }
      : { [ARCHIVED_AT_SORT_FIELD]: { $ifNull: ['$archivedAt', '$updatedAt'] } };

    const aggregateMatch = castTicketQueryForAggregate(query);

    [tickets, total] = await Promise.all([
      Ticket.aggregate([
        { $match: aggregateMatch },
        { $addFields: computedSortFields },
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
        ...blockerLookupStages(),
        // Excluding a field the pipeline never added is a no-op, so one projection
        // covers both branches.
        { $project: { priorityRank: 0, [ARCHIVED_AT_SORT_FIELD]: 0, blockedByTicket: 0 } },
      ]),
      Ticket.countDocuments(query),
    ]);
  }

  // Comment counts for the page the caller actually gets, not the whole match —
  // one grouped count over the returned ids. Done here rather than inside the two
  // branches above because one is a `find()` and the other an `aggregate()`;
  // attaching it once keeps the sort and pagination logic in each untouched.
  const ticketsWithCounts = await attachCommentCounts(tickets);

  return {
    tickets: ticketsWithCounts,
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
    .populate('category')
    .populate(BLOCKER_POPULATE);

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

  await ensureCategoryBelongsToWorkspace({
    workspaceId: ticketData.workspaceId,
    categoryId: ticketData.category,
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

  // statusDoc already carries these fields — no need to re-fetch it by slug.
  const statusFlags = {
    tracksTime: statusDoc.tracksTime,
    isDone: statusDoc.isDone,
    isBacklog: statusDoc.isBacklog,
  };

  const dueDate = parseOptionalDueDate(ticketData.dueDate);

  const sanitizedSubject = sanitizeTicketSubject(ticketData.subject);
  if (!sanitizedSubject) {
    throw new Error('Subject details are required');
  }

  // A blocker is only meaningful on a Blocked ticket; anything sent alongside a
  // different status is dropped rather than stored for a state it doesn't describe.
  const requestedBlocker = parseBlockerInput(ticketData.blockedBy);
  const blockedBy = resolveBlockerUpdate({
    isBlocked: isBlockedStatusSlug(statusDoc.slug),
    requested: requestedBlocker,
    current: { ticketId: null, note: '' },
  });

  const blockingTicket = blockedBy?.ticket
    ? await resolveBlockingTicket({
        workspaceId: ticketData.workspaceId,
        blockerTicketId: blockedBy.ticket,
      })
    : null;

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
    ...(blockedBy ? { blockedBy } : {}),
  });

  await ticket.save();

  historyService.logEvent(ticket._id, ticketData.creatorId, 'Ticket Created');

  if (blockingTicket) {
    historyService.logEvent(
      ticket._id,
      ticketData.creatorId,
      `Blocked by ${ticketRefLabel(blockingTicket)}`
    );
  }

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
    BLOCKER_POPULATE,
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

// Workspace-checked assignee/category, plus dueDate parsing. Subject/description
// sanitizing stays in updateTicket itself — it runs before the ticket is fetched
// and doesn't need oldTicket, so folding it in here would reorder error precedence.
const applyValidatedFieldUpdates = async (updateData, oldTicket) => {
  if (Object.prototype.hasOwnProperty.call(updateData, 'assignedTo')) {
    await ensureAssignableUsersBelongToWorkspace({
      workspaceId: oldTicket.workspace,
      assignedTo: updateData.assignedTo,
    });
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'category')) {
    await ensureCategoryBelongsToWorkspace({
      workspaceId: oldTicket.workspace,
      categoryId: updateData.category,
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
};

// Mutates updateData.status/statusId and returns what the rest of updateTicket
// needs to finish the request: whether it changed, the resolved doc (the blocker
// step below needs it), and the history line (held, not logged — the caller only
// logs it after the ticket is actually persisted).
const resolveStatusTransition = async ({ oldTicket, updateData }) => {
  let statusChanged = false;
  let nextStatusDoc = null;
  let statusHistoryEntry = null;

  const statusInput = updateData.statusId ?? updateData.status;
  if (!statusInput) {
    return { statusChanged, nextStatusDoc, statusHistoryEntry };
  }

  const statusDoc = await statusService.resolveStatusForWorkspace(oldTicket.workspace, statusInput);
  nextStatusDoc = statusDoc;
  // Single fetch for the old status doc — replaces separate slug/label/flags
  // lookups that each independently re-fetched the same document.
  const oldStatusDoc = await statusService.getStatusDocFromTicketRef(oldTicket.status);

  if (!statusService.statusIdsMatch(oldTicket.status, statusDoc._id)) {
    statusChanged = true;
    if (statusDoc.isBacklog && !oldStatusDoc?.isBacklog) {
      throw new Error('Tickets cannot be moved back to the backlog.');
    }

    const now = new Date();
    const oldLabel = oldStatusDoc?.label || 'Unknown';
    const newLabel = statusDoc.label;

    updateData.status = statusDoc._id;
    delete updateData.statusId;

    await statusService.applyStatusLifecycleUpdate({
      oldFlags: {
        tracksTime: oldStatusDoc?.tracksTime,
        isDone: oldStatusDoc?.isDone,
        isBacklog: oldStatusDoc?.isBacklog,
      },
      newFlags: {
        tracksTime: statusDoc.tracksTime,
        isDone: statusDoc.isDone,
        isBacklog: statusDoc.isBacklog,
      },
      oldTicket,
      updateData,
      now,
    });

    statusHistoryEntry = `Status changed from "${oldLabel}" to "${newLabel}"`;
  } else {
    delete updateData.status;
    delete updateData.statusId;
  }

  return { statusChanged, nextStatusDoc, statusHistoryEntry };
};

// Resolved against the status the ticket ENDS UP in, not the one it had: a
// ticket moving into Blocked can carry its blocker in the same request, and a
// ticket moving out of it loses the blocker whether or not the client said so.
// Skipped entirely for the common edit that neither sends a blocker nor has one.
// Mutates updateData.blockedBy; returns the history lines (held, same reason as
// the status ones above).
const resolveBlockerTransition = async ({
  oldTicket,
  updateData,
  requestedBlocker,
  nextStatusDoc,
  ticketId,
}) => {
  let blockerHistoryEntries = [];
  const currentBlocker = readBlocker(oldTicket);

  if (requestedBlocker === undefined && !currentBlocker.ticketId && !currentBlocker.note) {
    return { blockerHistoryEntries };
  }

  const effectiveStatusDoc =
    nextStatusDoc || (await statusService.getStatusDocFromTicketRef(oldTicket.status));

  const blockedBy = resolveBlockerUpdate({
    isBlocked: isBlockedStatusSlug(effectiveStatusDoc?.slug),
    requested: requestedBlocker,
    current: currentBlocker,
  });

  if (blockedBy) {
    const labels = new Map();

    if (blockedBy.ticket) {
      const blockingTicket = await resolveBlockingTicket({
        workspaceId: oldTicket.workspace,
        blockerTicketId: blockedBy.ticket,
        ticketId,
        previousBlockerId: currentBlocker.ticketId,
      });
      labels.set(String(blockingTicket._id), ticketRefLabel(blockingTicket));
    }

    if (currentBlocker.ticketId && !labels.has(currentBlocker.ticketId)) {
      const previousTicket = await Ticket.findById(currentBlocker.ticketId)
        .select('taskNumber')
        .lean();
      labels.set(currentBlocker.ticketId, ticketRefLabel(previousTicket));
    }

    updateData.blockedBy = blockedBy;
    blockerHistoryEntries = describeBlockerChange({
      previous: currentBlocker,
      next: blockedBy,
      labelFor: (id) => labels.get(String(id)) || 'another ticket',
    });
  }

  return { blockerHistoryEntries };
};

const persistTicketUpdate = async (ticketId, updateData) => {
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
    .populate('creator', 'fullName')
    .populate(BLOCKER_POPULATE);

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  return ticket;
};

// Notifies newly-assigned users and logs the assignee history line. Returns what
// emitUpdateEvents needs to decide the `assigned` socket event.
const applyAssigneeSideEffects = async ({
  ticketId,
  ticket,
  previousAssignedTo,
  updateData,
  actorUserId,
}) => {
  let assigneesChanged = false;
  let newlyAssignedUserIds = [];

  if (!Object.prototype.hasOwnProperty.call(updateData, 'assignedTo')) {
    return { assigneesChanged, newlyAssignedUserIds };
  }

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

  return { assigneesChanged, newlyAssignedUserIds };
};

// History lines for the remaining plain fields — no side effects beyond the log.
const logFieldChangeHistory = async ({ ticketId, oldTicket, updateData, actorUserId }) => {
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
};

const emitUpdateEvents = ({
  ticket,
  oldTicket,
  statusChanged,
  assigneesChanged,
  newlyAssignedUserIds,
  isStatusOnlyRequest,
}) => {
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

    // Parsed before the update object is written so a malformed blocker fails the
    // whole request rather than half of it. Removed from `updateData` either way:
    // what gets stored is decided below, against the status the ticket ends up in.
    const requestedBlocker = parseBlockerInput(updateData.blockedBy);
    delete updateData.blockedBy;

    await applyValidatedFieldUpdates(updateData, oldTicket);

    const { statusChanged, nextStatusDoc, statusHistoryEntry } = await resolveStatusTransition({
      oldTicket,
      updateData,
    });

    const { blockerHistoryEntries } = await resolveBlockerTransition({
      oldTicket,
      updateData,
      requestedBlocker,
      nextStatusDoc,
      ticketId,
    });

    const ticket = await persistTicketUpdate(ticketId, updateData);

    // Logged only now, after the ticket is actually persisted — a rejected update
    // that left "Status changed from X to Y" in the history would have the log
    // claiming a move the database never made.
    if (statusHistoryEntry) {
      historyService.logEvent(ticketId, actorUserId, statusHistoryEntry);
    }
    blockerHistoryEntries.forEach((entry) => historyService.logEvent(ticketId, actorUserId, entry));

    const { assigneesChanged, newlyAssignedUserIds } = await applyAssigneeSideEffects({
      ticketId,
      ticket,
      previousAssignedTo,
      updateData,
      actorUserId,
    });

    await logFieldChangeHistory({ ticketId, oldTicket, updateData, actorUserId });

    emitUpdateEvents({
      ticket,
      oldTicket,
      statusChanged,
      assigneesChanged,
      newlyAssignedUserIds,
      isStatusOnlyRequest,
    });

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
    const escapedSearch = escapeRegex(search);
    query.$or = [
      { subject: { $regex: escapedSearch, $options: 'i' } },
      { description: { $regex: escapedSearch, $options: 'i' } },
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
          _id: -1, // unique tiebreaker — see buildTicketListSort
        };

  const sortField = normalizeTicketSortField(sortBy);
  const sortSpec = buildTicketListSort(sortField, sortOrder === 'asc' ? 1 : -1);

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
          .populate(BLOCKER_LIST_POPULATE)
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
          ...blockerLookupStages(),
          { $project: { priorityRank: 0, blockedByTicket: 0 } },
        ]);

  if (normalizedOrder === 'none' && sortField === 'subject') {
    ticketsQuery.collation(SUBJECT_SORT_COLLATION);
  }

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
  INVALID_CATEGORY_ERROR,
};
