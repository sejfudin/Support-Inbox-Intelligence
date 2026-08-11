const mongoose = require('mongoose');
const StaffingRequest = require('../models/StaffingRequest');
const Recommendation = require('../models/Recommendation');
const Project = require('../models/Project');
const { PROJECT_TYPES, PROJECT_STATUSES } = Project;
const Position = require('../models/Position');
const Technology = require('../models/Technology');
const History = require('../models/History');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { httpError } = require('../helpers/httpError');
const {
  deriveProgress,
  assertCanResolveProject,
  assertRequestedPositionsEditable,
  assertCanClose,
  applyClose,
  assertCanReopen,
  applyReopen,
  deriveUnreadStaffingRequestIds,
} = require('../helpers/staffingRequestRules');
const { slugify } = require('../helpers/slugify');
const { logStaffingRequestEvent } = require('./historyService');
const { emitStaffingNewsChanged } = require('../socket/events');

// This is the platform's first leadership write path: no existing route
// admits ROLES.LEADERSHIP for a write, so every guard below is explicit
// rather than leaning on a middleware default.
const READ_ROLES = [ROLES.ADMIN, ROLES.LEADERSHIP];

const REQUEST_POPULATE = [
  { path: 'author', select: 'fullname email role' },
  { path: 'project', select: 'name slug status type' },
  { path: 'requestedPositions.position', select: 'name slug' },
  { path: 'requestedPositions.technologies', select: 'name slug' },
  { path: 'closedBy', select: 'fullname email role' },
  { path: 'noteBy', select: 'fullname email role' },
];

const assertValidObjectId = (id, label) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(`${label} is invalid`, 400);
  }
};

const assertReadAccess = (user) => {
  if (!READ_ROLES.includes(user.role)) {
    throw httpError('Not authorized', 403);
  }
};

// Creating a staffing request is leadership-only — recorded demand should
// always trace back to an outside ask that came through leadership.
const assertCreateAccess = (user) => {
  if (user.role !== ROLES.LEADERSHIP) {
    throw httpError('Only leadership may file a staffing request', 403);
  }
};

// Editing / cancelling / reopening: the author or any admin. Mentors and
// interns are rejected by the role-tier gate; leadership members who aren't
// the author are rejected by the author-or-admin check right after it.
const assertWriteAccess = (user, request) => {
  assertReadAccess(user);
  const isAuthor = String(request.author) === String(user._id);
  const isAdmin = user.role === ROLES.ADMIN;
  if (!isAuthor && !isAdmin) {
    throw httpError('Only the author or an admin may modify this staffing request', 403);
  }
};

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const parseDate = (value, label) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw httpError(`${label} is invalid`, 400);
  }
  return date;
};

const ensurePositionId = async (positionId) => {
  assertValidObjectId(positionId, 'Position');
  const exists = await Position.exists({ _id: positionId });
  if (!exists) throw httpError('Position is invalid', 400);
  return positionId;
};

const ensureTechnologyIds = async (technologyIds = []) => {
  const ids = [...new Set((technologyIds || []).filter(Boolean).map((id) => id.toString()))];
  ids.forEach((id) => assertValidObjectId(id, 'Technology'));
  if (ids.length === 0) return [];
  const count = await Technology.countDocuments({ _id: { $in: ids }, isActive: true });
  if (count !== ids.length) throw httpError('One or more technologies are invalid', 400);
  return ids;
};

const ensureProjectId = async (projectId) => {
  assertValidObjectId(projectId, 'Project');
  const project = await Project.findById(projectId).select('_id');
  if (!project) throw httpError('Project is invalid', 400);
  return project._id;
};

const normalizeRequestedPositions = async (requestedPositions) => {
  if (!Array.isArray(requestedPositions) || requestedPositions.length === 0) {
    throw httpError('At least one requested position is required', 400);
  }

  return Promise.all(
    requestedPositions.map(async (requestedPosition) => {
      const count = Number(requestedPosition.count);
      if (!Number.isInteger(count) || count < 1) {
        throw httpError('Count must be an integer of at least 1', 400);
      }
      return {
        position: await ensurePositionId(requestedPosition.position),
        count,
        technologies: await ensureTechnologyIds(requestedPosition.technologies),
      };
    })
  );
};

// Position ids (as strings) among `requestedPositions` that currently have at
// least one recommendation tagged to this request for that position.
const loadPositionsWithRecommendations = async (requestId) => {
  const tagged = await Recommendation.find({ staffingRequest: requestId })
    .select('position')
    .lean();
  return [...new Set(tagged.map((recommendation) => String(recommendation.position)))];
};

// Recommendations tagged to a request, for the rules helper's progress/
// display-state derivation and for the per-position suggestion cards. Fetched
// separately from REQUEST_POPULATE because it's a reverse lookup
// (Recommendation -> staffingRequest), not a field on the request document
// itself. Only the fields those cards render are selected — everything else
// about a recommendation stays behind the recommendations API and its own read
// guard. Both staffing-request read routes are admin+leadership, the same tier
// as recommendationService's READ_ROLES, so this widens no one's access.
const loadTaggedRecommendations = async (requestIds) => {
  const recommendations = await Recommendation.find({ staffingRequest: { $in: requestIds } })
    .select('staffingRequest position result status technologies internProfile')
    // `position` is deliberately left unpopulated — deriveProgress matches it
    // against requestedPositions by id, and a populated document would never
    // compare equal. The frontend already has the populated position names.
    .populate({ path: 'technologies', select: 'name' })
    .populate({
      path: 'internProfile',
      select: 'user startDate',
      populate: { path: 'user', select: 'fullname' },
    })
    .lean();
  const byRequestId = new Map();
  for (const recommendation of recommendations) {
    const key = String(recommendation.staffingRequest);
    if (!byRequestId.has(key)) byRequestId.set(key, []);
    byRequestId.get(key).push(recommendation);
  }
  return byRequestId;
};

// One suggestion card's worth of a tagged recommendation: who was put forward,
// for which requested position, and what they bring. `position` stays a raw id
// — the frontend groups by it against its own populated requestedPositions.
const formatSuggestion = (recommendation) => ({
  id: recommendation._id,
  position: recommendation.position,
  internName: recommendation.internProfile?.user?.fullname ?? 'Unknown intern',
  internProfile: recommendation.internProfile?._id ?? null,
  startDate: recommendation.internProfile?.startDate ?? null,
  technologies: (recommendation.technologies ?? [])
    .map((technology) => technology?.name)
    .filter(Boolean),
  status: recommendation.status,
  outcome: recommendation.result?.outcome ?? null,
});

// The one place a request document is turned into a response: raw fields plus
// `progress` (wanted / putForward / placed, per position and in total) and the
// suggestions themselves. No derived status — `status` and `reason` are stored,
// and anything else a screen wants to say is a comparison on these counts.
const formatRequest = (request, recommendations = []) => {
  const plain = request.toObject ? request.toObject() : request;
  return {
    ...plain,
    id: plain._id,
    progress: deriveProgress(plain.requestedPositions, recommendations),
    suggestions: recommendations.map(formatSuggestion),
  };
};

const formatRequestWithLookup = async (request) => {
  const byRequestId = await loadTaggedRecommendations([request._id]);
  return formatRequest(request, byRequestId.get(String(request._id)) || []);
};

const listStaffingRequests = async (user, query = {}) => {
  assertReadAccess(user);

  const filter = {};
  if (query.status) {
    if (!['open', 'closed'].includes(query.status)) {
      throw httpError('Invalid status filter', 400);
    }
    filter.status = query.status;
  }
  if (query.authorId) {
    assertValidObjectId(query.authorId, 'Author');
    filter.author = query.authorId;
  }
  // Narrows to one project. With `status=open` this is the "does this project
  // already have demand recorded against it" lookup the filing form asks
  // BEFORE it files, so the warning can offer a choice instead of announcing a
  // request that already exists.
  if (query.projectId) {
    assertValidObjectId(query.projectId, 'Project');
    filter.project = query.projectId;
  }
  // Convenience "mine" filter, one query parameter.
  if (query.mine === 'true') {
    filter.author = user._id;
  }

  const requests = await StaffingRequest.find(filter)
    .populate(REQUEST_POPULATE)
    .sort({ createdAt: -1 });

  const byRequestId = await loadTaggedRecommendations(requests.map((request) => request._id));
  return requests.map((request) =>
    formatRequest(request, byRequestId.get(String(request._id)) || [])
  );
};

const getStaffingRequest = async (user, requestId) => {
  assertReadAccess(user);
  assertValidObjectId(requestId, 'Staffing request');

  const request = await StaffingRequest.findById(requestId).populate(REQUEST_POPULATE);
  if (!request) throw httpError('Staffing request not found', 404);

  return formatRequestWithLookup(request);
};

const createStaffingRequest = async (user, payload = {}) => {
  assertCreateAccess(user);

  const hasProject = Boolean(payload.projectId);
  const hasDraftProject = Boolean(payload.draftProject);
  if (hasProject === hasDraftProject) {
    throw httpError('Exactly one of project or draft project details must be set', 400);
  }

  const requestedPositions = await normalizeRequestedPositions(payload.requestedPositions);

  // Filing against a project that already has an open request is allowed and
  // not even remarked on here: a second wave of demand months later is
  // legitimately its own request. Warning about it is a decision the caller
  // makes before filing, off `GET /?projectId=&status=open`.
  let projectId;
  if (hasProject) {
    projectId = await ensureProjectId(payload.projectId);
  }

  let draftProject;
  if (hasDraftProject) {
    const name = cleanText(payload.draftProject.name);
    if (!name) throw httpError('Draft project name is required', 400);
    draftProject = {
      name,
      client: cleanText(payload.draftProject.client),
      description: cleanText(payload.draftProject.description),
    };
  }

  const request = await StaffingRequest.create({
    project: projectId,
    draftProject,
    requestedPositions,
    author: user._id,
    // No `note` — it is the admin's remark on this request, and no admin has
    // looked at it yet. See setStaffingRequestNote.
    neededBy: parseDate(payload.neededBy, 'Needed-by date') || undefined,
    status: 'open',
  });

  await request.populate(REQUEST_POPULATE);

  // Awaited and unswallowed on purpose — this write is the news mechanism for
  // the admin/leadership badge (ticket 04), not a best-effort audit line.
  await logStaffingRequestEvent({
    entityId: request._id,
    userId: user._id,
    action: 'Request filed',
    statusKey: 'staffing:filed',
  });
  emitStaffingNewsChanged();

  return formatRequestWithLookup(request);
};

// Counts, technologies, needed-by only — per ticket 02. `note` belongs to the
// admin who wrote it, so an author edit can never touch it. Moving the
// project reference is "resolve project" (tickets 05/06/07's job, not this
// one's) and is deliberately not accepted here.
const updateStaffingRequest = async (user, requestId, payload = {}) => {
  assertValidObjectId(requestId, 'Staffing request');
  const request = await StaffingRequest.findById(requestId);
  if (!request) throw httpError('Staffing request not found', 404);

  assertWriteAccess(user, request);

  const positionsWithRecommendations = await loadPositionsWithRecommendations(request._id);
  const nextRequestedPositions =
    payload.requestedPositions !== undefined
      ? await normalizeRequestedPositions(payload.requestedPositions)
      : request.requestedPositions;

  // The single source of truth for "is this request editable at all" —
  // closed-request rejection lives in the rules helper, never re-implemented
  // here, even for a note/needed-by-only edit that touches no position.
  try {
    assertRequestedPositionsEditable(request, nextRequestedPositions, positionsWithRecommendations);
  } catch (error) {
    throw httpError(error.message, 400);
  }

  request.requestedPositions = nextRequestedPositions;

  if (payload.neededBy !== undefined) {
    request.neededBy = parseDate(payload.neededBy, 'Needed-by date');
  }

  await request.save();
  await request.populate(REQUEST_POPULATE);

  return formatRequestWithLookup(request);
};

// A rules-helper refusal is a 403 when it means "not you" and a 400 when it
// means "not a legal move" — the helper tags the former with FORBIDDEN so this
// mapping never has to match on message text.
const asHttpError = (error) => httpError(error.message, error.code === 'FORBIDDEN' ? 403 : 400);

const loadResolvableRequest = async (user, requestId) => {
  // Admin-only for both halves of resolution (link and create-then-link) —
  // leadership can describe a project it wants, it can never create or link
  // one. There is no author-or-admin carve-out here, unlike every other write
  // path on this model.
  if (user.role !== ROLES.ADMIN) {
    throw httpError('Only an admin may resolve a staffing request project', 403);
  }
  assertValidObjectId(requestId, 'Staffing request');
  const request = await StaffingRequest.findById(requestId);
  if (!request) throw httpError('Staffing request not found', 404);

  try {
    assertCanResolveProject(request);
  } catch (error) {
    throw asHttpError(error);
  }
  return request;
};

// The one write both halves of resolution end with: link the project, keep
// `draftProject` exactly as leadership wrote it, log the event that feeds the
// news badge (ticket 04), and return the same shape every other read does.
const finishResolvingProject = async (request, projectId, userId) => {
  request.project = projectId;
  await request.save();
  await request.populate(REQUEST_POPULATE);

  await logStaffingRequestEvent({
    entityId: request._id,
    userId,
    action: 'Project resolved',
    statusKey: 'staffing:project_resolved',
  });
  emitStaffingNewsChanged();

  return formatRequestWithLookup(request);
};

// Links an unresolved request to a project that already exists — the "found
// it, use this one" half of resolution. `draftProject` is never touched: it
// stays the evidence of what was actually asked for.
const resolveStaffingRequestProject = async (user, requestId, payload = {}) => {
  const request = await loadResolvableRequest(user, requestId);
  const projectId = await ensureProjectId(payload.projectId);
  return finishResolvingProject(request, projectId, user._id);
};

// Creates a new project from the admin's own choices — prefilled from the
// draft on the client, but `type`, `status` and `technologies` are never
// seeded from the request; the admin picks them fresh every time (leadership
// never classifies a project). A slug collision is looked up proactively so
// it comes back as "link to it instead?" with the actual conflicting project,
// not a raw duplicate-key error; the schema's unique index is still the
// last-resort catch for the race between the check and the insert.
const resolveStaffingRequestProjectByCreating = async (user, requestId, payload = {}) => {
  const request = await loadResolvableRequest(user, requestId);
  const draft = payload.project || {};

  const name = cleanText(draft.name);
  if (!name) throw httpError('Project name is required', 400);
  if (!PROJECT_TYPES.includes(draft.type)) throw httpError('Invalid project type', 400);
  const status = draft.status !== undefined ? draft.status : 'active';
  if (!PROJECT_STATUSES.includes(status)) throw httpError('Invalid project status', 400);

  const slug = slugify(name);
  if (slug === 'unspecified') throw httpError('This project name is reserved', 400);

  const collision = await Project.findOne({ slug }).select('_id name slug').lean();
  if (collision) {
    throw Object.assign(
      httpError('A project with this slug already exists — link to it instead?', 409),
      { data: { existingProject: collision } }
    );
  }

  const technologyIds = await ensureTechnologyIds(draft.technologyIds);

  let project;
  try {
    project = await Project.create({
      name,
      slug,
      type: draft.type,
      status,
      client: cleanText(draft.client),
      description: cleanText(draft.description),
      technologies: technologyIds,
    });
  } catch (error) {
    // Fallback for the race between the check above and this insert — same
    // friendly shape, not a raw Mongo error.
    if (error.code === 11000) {
      const existingProject = await Project.findOne({ slug }).select('_id name slug').lean();
      throw Object.assign(
        httpError('A project with this slug already exists — link to it instead?', 409),
        { data: { existingProject } }
      );
    }
    throw error;
  }

  return finishResolvingProject(request, project._id, user._id);
};

// The one close path, for all three reasons. `assertCanClose` owns who may use
// which reason (cancel: author or admin; fulfil/decline: admin only, and
// decline needs a note), so this function never re-implements that split.
//
// Where the supplied note lands depends on the reason, and the two fields are
// not interchangeable:
//   cancelled → `closeNote`. Withdrawing an ask must never overwrite what an
//               admin already said about it.
//   declined  → `note` (+ `noteBy`/`noteAt`). Mandatory, and it IS the admin's
//               remark — the model enforces both the non-empty text and the
//               attribution triple.
//   fulfilled → `note` if one was given, otherwise nothing.
const closeStaffingRequest = async (user, requestId, payload = {}) => {
  assertValidObjectId(requestId, 'Staffing request');
  const request = await StaffingRequest.findById(requestId);
  if (!request) throw httpError('Staffing request not found', 404);

  assertWriteAccess(user, request);

  const isAdmin = user.role === ROLES.ADMIN;
  const isAuthor = String(request.author) === String(user._id);
  const note = cleanText(payload.note);

  try {
    assertCanClose(request, { isAdmin, isAuthor, reason: payload.reason, note });
  } catch (error) {
    throw asHttpError(error);
  }

  const closedAt = new Date();
  Object.assign(
    request,
    applyClose(request, { reason: payload.reason, closedBy: user._id, closedAt })
  );

  if (payload.reason === 'cancelled') {
    if (payload.note !== undefined) {
      request.closeNote = note;
    }
  } else if (note) {
    request.note = note;
    request.noteBy = user._id;
    request.noteAt = closedAt;
  }

  await request.save();
  await request.populate(REQUEST_POPULATE);

  return formatRequestWithLookup(request);
};

// Reopening clears every close marker, so a reopened request is
// indistinguishable from one that was never closed. `closeNote` and `note`
// deliberately survive: they are the record of what happened, and the next
// close writes over them anyway.
const reopenStaffingRequest = async (user, requestId) => {
  assertValidObjectId(requestId, 'Staffing request');
  const request = await StaffingRequest.findById(requestId);
  if (!request) throw httpError('Staffing request not found', 404);

  assertWriteAccess(user, request);

  const isAdmin = user.role === ROLES.ADMIN;
  const isAuthor = String(request.author) === String(user._id);

  try {
    assertCanReopen(request, { isAdmin, isAuthor });
  } catch (error) {
    throw asHttpError(error);
  }

  Object.assign(request, applyReopen());

  await request.save();
  await request.populate(REQUEST_POPULATE);

  return formatRequestWithLookup(request);
};

// The admin's remark on a request, attributed and stamped so leadership sees
// who said it and when. Admin-only: leadership must not be able to write a
// note onto its own ask. Saving again replaces the previous text — one note per
// request, by design, not a thread. Eventually this is saved as part of picking
// candidates (the fulfil flow); until that exists it has its own write path.
const setStaffingRequestNote = async (user, requestId, payload = {}) => {
  assertValidObjectId(requestId, 'Staffing request');
  const request = await StaffingRequest.findById(requestId);
  if (!request) throw httpError('Staffing request not found', 404);

  assertReadAccess(user);
  if (user.role !== ROLES.ADMIN) {
    throw httpError('Only an admin may add a note to a staffing request', 403);
  }
  if (request.status === 'closed') {
    throw httpError('Cannot note a closed staffing request', 400);
  }

  const note = cleanText(payload.note);
  if (!note) throw httpError('Note text is required', 400);

  request.note = note;
  request.noteBy = user._id;
  request.noteAt = new Date();

  await request.save();
  await request.populate(REQUEST_POPULATE);

  return formatRequestWithLookup(request);
};

// Which requests carry news the viewer hasn't seen, and how many — drives the
// Requests nav badge on both shells. Fetches raw staffing-request events
// rather than aggregating in Mongo so the "unread" policy lives in one place
// (deriveUnreadStaffingRequestIds) instead of being reimplemented as a
// parallel aggregation pipeline that could quietly drift from it.
const getStaffingRequestNews = async (user) => {
  assertReadAccess(user);

  const lastSeenAt = user.staffingRequestsLastSeenAt || null;
  const events = await History.find({
    entityType: 'staffingRequest',
    ...(lastSeenAt ? { timestamp: { $gt: lastSeenAt } } : {}),
  })
    .select('entityId userId timestamp')
    .lean();

  const unread = deriveUnreadStaffingRequestIds(events, {
    lastSeenAt,
    viewerId: user._id,
  });

  return { count: unread.size, requestIds: [...unread] };
};

// Stamps the viewer's last-seen timestamp to now — called when the Requests
// tab/nav entry is opened. Read state is per viewer, not per request.
const markStaffingRequestsSeen = async (user) => {
  assertReadAccess(user);
  const lastSeenAt = new Date();
  await User.findByIdAndUpdate(user._id, { staffingRequestsLastSeenAt: lastSeenAt });
  return { lastSeenAt };
};

// The full trail behind a request's badge — who did what, when. Same shape as
// the ticket history read (server/controllers/history.js): no populate, the
// actor's name is read off the denormalized userName stored at write time.
const getStaffingRequestHistory = async (user, requestId) => {
  assertReadAccess(user);
  assertValidObjectId(requestId, 'Staffing request');

  const exists = await StaffingRequest.exists({ _id: requestId });
  if (!exists) throw httpError('Staffing request not found', 404);

  return History.find({ entityType: 'staffingRequest', entityId: requestId })
    .sort({ timestamp: -1 })
    .lean();
};

module.exports = {
  setStaffingRequestNote,
  listStaffingRequests,
  getStaffingRequest,
  createStaffingRequest,
  updateStaffingRequest,
  resolveStaffingRequestProject,
  resolveStaffingRequestProjectByCreating,
  closeStaffingRequest,
  reopenStaffingRequest,
  getStaffingRequestNews,
  markStaffingRequestsSeen,
  getStaffingRequestHistory,
};
