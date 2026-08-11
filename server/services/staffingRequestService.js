const mongoose = require('mongoose');
const StaffingRequest = require('../models/StaffingRequest');
const Recommendation = require('../models/Recommendation');
const Project = require('../models/Project');
const Position = require('../models/Position');
const Technology = require('../models/Technology');
const { ROLES } = require('../constants/roles');
const { httpError } = require('../helpers/httpError');
const {
  assertRequestedPositionsEditable,
  assertCanClose,
} = require('../helpers/staffingRequestRules');

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

const formatRequest = (request) => {
  const plain = request.toObject ? request.toObject() : request;
  return {
    ...plain,
    id: plain._id,
  };
};

// A request is "duplicate demand" when another OPEN request already targets
// the same resolved project — surfaced as a warning, never a rejection: a
// second wave of demand months later is legitimately its own request.
const findExistingOpenRequestForProject = async (projectId) => {
  if (!projectId) return null;
  const existing = await StaffingRequest.findOne({ project: projectId, status: 'open' })
    .populate({ path: 'author', select: 'fullname email' })
    .sort({ createdAt: 1 })
    .select('author createdAt');
  if (!existing) return null;
  return { author: existing.author, filedAt: existing.createdAt };
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
  // Convenience "mine" filter, one query parameter.
  if (query.mine === 'true') {
    filter.author = user._id;
  }

  const requests = await StaffingRequest.find(filter)
    .populate(REQUEST_POPULATE)
    .sort({ createdAt: -1 });

  return requests.map(formatRequest);
};

const getStaffingRequest = async (user, requestId) => {
  assertReadAccess(user);
  assertValidObjectId(requestId, 'Staffing request');

  const request = await StaffingRequest.findById(requestId).populate(REQUEST_POPULATE);
  if (!request) throw httpError('Staffing request not found', 404);

  return formatRequest(request);
};

const createStaffingRequest = async (user, payload = {}) => {
  assertCreateAccess(user);

  const hasProject = Boolean(payload.projectId);
  const hasDraftProject = Boolean(payload.draftProject);
  if (hasProject === hasDraftProject) {
    throw httpError('Exactly one of project or draft project details must be set', 400);
  }

  const requestedPositions = await normalizeRequestedPositions(payload.requestedPositions);

  let projectId;
  let duplicateOf = null;
  if (hasProject) {
    projectId = await ensureProjectId(payload.projectId);
    duplicateOf = await findExistingOpenRequestForProject(projectId);
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
    note: cleanText(payload.note),
    neededBy: parseDate(payload.neededBy, 'Needed-by date') || undefined,
    status: 'open',
  });

  await request.populate(REQUEST_POPULATE);

  return { request: formatRequest(request), duplicateOf };
};

// Counts, technologies, note, needed-by only — per ticket 02. Moving the
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

  if (payload.note !== undefined) {
    request.note = cleanText(payload.note);
  }
  if (payload.neededBy !== undefined) {
    request.neededBy = parseDate(payload.neededBy, 'Needed-by date');
  }

  await request.save();
  await request.populate(REQUEST_POPULATE);

  return formatRequest(request);
};

const cancelStaffingRequest = async (user, requestId, payload = {}) => {
  assertValidObjectId(requestId, 'Staffing request');
  const request = await StaffingRequest.findById(requestId);
  if (!request) throw httpError('Staffing request not found', 404);

  assertWriteAccess(user, request);

  const isAdmin = user.role === ROLES.ADMIN;
  const isAuthor = String(request.author) === String(user._id);

  try {
    assertCanClose(request, { isAdmin, isAuthor, reason: 'cancelled', note: payload.note });
  } catch (error) {
    throw httpError(error.message, 400);
  }

  request.status = 'closed';
  request.reason = 'cancelled';
  request.closedBy = user._id;
  request.closedAt = new Date();
  if (payload.note !== undefined) {
    request.note = cleanText(payload.note);
  }

  await request.save();
  await request.populate(REQUEST_POPULATE);

  return formatRequest(request);
};

module.exports = {
  listStaffingRequests,
  getStaffingRequest,
  createStaffingRequest,
  updateStaffingRequest,
  cancelStaffingRequest,
};
