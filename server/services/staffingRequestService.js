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
  IN_SELECTION_STATUSES,
  PICKER_EXCLUDED_INTERN_STATUSES,
  deriveProgress,
  partitionPickerCandidates,
  assertCanResolveProject,
  assertCanPutForward,
  assertRequestedPositionsEditable,
  assertCanClose,
  applyClose,
  selectCloseOutRecommendations,
  deriveUnreadStaffingRequestIds,
} = require('../helpers/staffingRequestRules');
const { slugify } = require('../helpers/slugify');
const { logStaffingRequestEvent } = require('./historyService');
const {
  createRecommendationsForStaffingRequest,
  closeOutRecommendationsForDemandEnd,
} = require('./recommendationService');
const { emitStaffingNewsChanged } = require('../socket/events');
const InternProfile = require('../models/InternProfile');

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

// Editing: the author or any admin. Mentors and interns are rejected by the
// role-tier gate; leadership members who aren't the author are rejected by the
// author-or-admin check right after it. Closing deliberately does NOT come
// through here — cancelling belongs to leadership as a side, not to one
// account, so `closeStaffingRequest` runs on the read tier and lets
// `assertCanClose` decide.
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

// Both put-forward paths (read the picker, write the picks) start the same way:
// the request must exist, the caller must be an admin, and the request must be
// open with a real project.
const loadRequestForPutForward = async (user, requestId) => {
  assertValidObjectId(requestId, 'Staffing request');

  const request = await StaffingRequest.findById(requestId);
  if (!request) throw httpError('Staffing request not found', 404);

  try {
    assertCanPutForward(request, { isAdmin: user.role === ROLES.ADMIN });
  } catch (error) {
    throw asHttpError(error);
  }

  return request;
};

// …then the position they named must actually be one this request asked for.
// That is what "the position is forced to the requested position" means
// server-side: there is no free-choice position in this flow, only one of the
// request's own.
const findRequestedPosition = (request, positionId) => {
  assertValidObjectId(positionId, 'Position');

  const requestedPosition = request.requestedPositions.find(
    (candidate) => String(candidate.position) === String(positionId)
  );
  if (!requestedPosition) {
    throw httpError('That position is not on this staffing request', 400);
  }

  return requestedPosition;
};

const loadRequestedPositionForPutForward = async (user, requestId, positionId) => {
  const request = await loadRequestForPutForward(user, requestId);
  return { request, requestedPosition: findRequestedPosition(request, positionId) };
};

// A picker-rule refusal, said in words rather than by leaking the rule's own
// token. Keyed by the flag types `partitionPickerCandidates` can exclude on —
// nothing is added to this map that the helper cannot produce, because the
// helper stays the only place the picker rules live. Phrased per intern,
// because a refusal is reported against the row it came from: one stale pick
// must not read as if the whole submit was wrong.
const PUT_FORWARD_REFUSALS = {
  discontinued: 'Has left the programme',
  completed: 'Has completed the programme',
  'already-put-forward': 'Already in selection for this position',
};

// Not a picker rule: the picker rules judge one intern against the programme
// and against a seat, and cannot see a cart at all. This is a property of the
// submitted body — the same intern appearing under two of one request's seats —
// so it is checked where the body is read.
const DUPLICATE_PICK_REFUSAL = 'Staged on more than one seat of this request';

// Whether a recommendation is a LIVE offer of this intern for this exact
// requested position. Only live ones make an intern "already put forward":
// someone whose process here fell through — closed out, or not placed — is a
// legitimate pick again, which is the whole reason the picker warns rather than
// blocks everywhere else.
const isLiveTagFor = (recommendation, requestId, positionId) =>
  String(recommendation.staffingRequest) === String(requestId) &&
  String(recommendation.position) === String(positionId) &&
  IN_SELECTION_STATUSES.includes(recommendation.status);

// Every intern still in the programme, plus the recommendations that say where
// else they are committed, partitioned by the picker rules. Excluded interns are
// dropped rather than returned: they are absent from the picker, not greyed out
// in it, because offering them is always a mistake and there is nothing for an
// admin to weigh up.
const listPutForwardCandidates = async (user, requestId, positionId) => {
  const { request, requestedPosition } = await loadRequestedPositionForPutForward(
    user,
    requestId,
    positionId
  );

  // Interns who have left the programme are filtered out in the query as well
  // as by the picker rules below — they can never appear, so there is no reason
  // to load them and their whole recommendation history first.
  const profiles = await InternProfile.find({ status: { $nin: PICKER_EXCLUDED_INTERN_STATUSES } })
    .select('user status startDate declaredPosition selfTechnologies cvTechnologies')
    .populate({ path: 'user', select: 'fullname email' })
    .populate({ path: 'declaredPosition', select: 'name' })
    .populate({ path: 'selfTechnologies', select: 'name' })
    .populate({ path: 'cvTechnologies', select: 'name' })
    .lean();

  const recommendations = await Recommendation.find({
    internProfile: { $in: profiles.map((profile) => profile._id) },
  })
    .select('internProfile project position status result staffingRequest')
    .populate({ path: 'project', select: 'name' })
    .lean();

  const recommendationsByProfile = new Map();
  for (const recommendation of recommendations) {
    const key = String(recommendation.internProfile);
    if (!recommendationsByProfile.has(key)) recommendationsByProfile.set(key, []);
    recommendationsByProfile.get(key).push(recommendation);
  }

  const alreadyPutForwardProfileIds = recommendations
    .filter((recommendation) => isLiveTagFor(recommendation, request._id, positionId))
    .map((recommendation) => recommendation.internProfile);

  const { warned, clean } = partitionPickerCandidates(
    profiles.map((profile) => ({
      internProfile: profile._id,
      status: profile.status,
      recommendations: recommendationsByProfile.get(String(profile._id)) ?? [],
    })),
    { projectId: request.project, alreadyPutForwardProfileIds }
  );

  const profilesById = new Map(profiles.map((profile) => [String(profile._id), profile]));
  const toCandidate = (partitioned) => {
    const profile = profilesById.get(String(partitioned.internProfile));
    return {
      internProfile: profile._id,
      internName: profile.user?.fullname ?? 'Unknown intern',
      email: profile.user?.email ?? null,
      status: profile.status,
      // How long they have been in the programme, the same anchor the suggestion
      // cards use — a candidate row that can't be compared on experience is only
      // half a row.
      startDate: profile.startDate ?? null,
      position: profile.declaredPosition?.name ?? null,
      // Both technology lists, because a picker matching against what the
      // request asked for should not care which of the two an intern's skill
      // was recorded in.
      technologies: [
        ...new Set(
          [...(profile.selfTechnologies ?? []), ...(profile.cvTechnologies ?? [])]
            .map((technology) => technology?.name)
            .filter(Boolean)
        ),
      ],
      eligibility: partitioned.eligibility,
      flags: partitioned.flags,
    };
  };

  // Clean first, then warned: an admin scanning the list should reach the
  // uncomplicated picks before the ones that need a decision.
  const byName = (a, b) => a.internName.localeCompare(b.internName);
  return {
    candidates: [...clean.map(toCandidate).sort(byName), ...warned.map(toCandidate).sort(byName)],
  };
};

// Normalise the submitted cart: one group per requested position, deduped
// within a group, empty groups dropped. Shape errors throw; picker-rule
// failures do not — those are collected per row further down.
const readPutForwardGroups = (request, payload) => {
  const rawGroups = Array.isArray(payload.groups) ? payload.groups : [];

  const groups = rawGroups
    .map((group) => {
      const requestedPosition = findRequestedPosition(request, group?.positionId);
      const internProfileIds = [
        ...new Set((group?.internProfileIds || []).filter(Boolean).map((id) => String(id))),
      ];
      internProfileIds.forEach((id) => assertValidObjectId(id, 'Intern'));
      return {
        positionId: String(group.positionId),
        internProfileIds,
        // Seeded from what the request asked for — the admin is answering this
        // requested position, so its technologies are the ones being matched.
        technologyIds: (requestedPosition.technologies ?? []).map((technology) =>
          String(technology)
        ),
      };
    })
    .filter((group) => group.internProfileIds.length > 0);

  if (groups.length === 0) {
    throw httpError('Pick at least one intern to put forward', 400);
  }
  if (new Set(groups.map((group) => group.positionId)).size !== groups.length) {
    throw httpError('That position is on this submission twice', 400);
  }

  return groups;
};

// The load-bearing write of the whole feature: putting interns forward creates
// ordinary recommendations tagged back to this request. The request never holds
// its own list of interns — who was put forward, and whether they were placed,
// is always read back off those recommendations (see docs/adr/0006).
//
// It takes the whole cart, not one position, because putting interns forward is
// the answer leadership is waiting on and there is one answer per submit: one
// insert, one history event, one badge, however many positions it spans.
// Over-supply is expected, not blocked: more interns than the count may be put
// forward, because interviews fail.
//
// Rejections are collected across every group and returned together, keyed by
// the row that produced them, rather than failing on the first one — an admin
// with one stale pick needs to know which pick, not that something was wrong.
const putInternsForward = async (user, requestId, payload = {}) => {
  const request = await loadRequestForPutForward(user, requestId);
  const groups = readPutForwardGroups(request, payload);

  const internProfileIds = [...new Set(groups.flatMap((group) => group.internProfileIds))];
  const profiles = await InternProfile.find({ _id: { $in: internProfileIds } })
    .select('status')
    .lean();
  if (profiles.length !== internProfileIds.length) {
    throw httpError('One or more interns are invalid', 400);
  }
  const profilesById = new Map(profiles.map((profile) => [String(profile._id), profile]));

  // The picker rules are enforced here too, not only in the UI: a cart goes
  // stale while it is staged, and a client that is out of date — or bypassed
  // entirely — must not be able to offer an intern who has left the programme
  // or who is already put forward for this seat.
  const tagged = await Recommendation.find({
    staffingRequest: request._id,
    position: { $in: groups.map((group) => group.positionId) },
    status: { $in: IN_SELECTION_STATUSES },
  })
    .select('internProfile position')
    .lean();

  const rejections = [];
  const seenProfileIds = new Set();
  for (const group of groups) {
    const alreadyPutForwardProfileIds = tagged
      .filter((recommendation) => String(recommendation.position) === group.positionId)
      .map((recommendation) => recommendation.internProfile);

    const { excluded } = partitionPickerCandidates(
      group.internProfileIds.map((id) => ({
        internProfile: id,
        status: profilesById.get(id).status,
      })),
      { alreadyPutForwardProfileIds }
    );
    excluded.forEach((candidate) =>
      rejections.push({
        positionId: group.positionId,
        internProfileId: String(candidate.internProfile),
        reason: PUT_FORWARD_REFUSALS[candidate.flags[0].type],
      })
    );

    // One seat per intern per request: staging someone onto a second seat of the
    // same request is offering the same person twice for one ask.
    for (const id of group.internProfileIds) {
      if (seenProfileIds.has(id)) {
        rejections.push({
          positionId: group.positionId,
          internProfileId: id,
          reason: DUPLICATE_PICK_REFUSAL,
        });
      }
      seenProfileIds.add(id);
    }
  }
  if (rejections.length > 0) {
    throw Object.assign(httpError('Some picks could not be sent', 409), {
      data: { rejections },
    });
  }

  await createRecommendationsForStaffingRequest(user, {
    groups,
    projectId: request.project,
    staffingRequestId: request._id,
  });

  await request.populate(REQUEST_POPULATE);
  const positionNames = groups.map(
    (group) =>
      request.requestedPositions.find(
        (candidate) => String(candidate.position?._id ?? candidate.position) === group.positionId
      )?.position?.name ?? 'position'
  );

  // The event names its consequence, not just its verb, and there is exactly
  // one of it per submit — the total across every position the cart spanned.
  // Individual placements deliberately do not badge the other side; only the
  // act of putting interns forward does, because that is the answer leadership
  // is waiting on.
  await logStaffingRequestEvent({
    entityId: request._id,
    userId: user._id,
    action: `${internProfileIds.length} put forward for ${positionNames.join(', ')}`,
    statusKey: 'staffing:put_forward',
  });
  emitStaffingNewsChanged();

  return formatRequestWithLookup(request);
};

// What a close is called in the trail, per reason. The event names its
// consequence rather than just its verb — a cancellation that ended four live
// processes is a different fact from one that ended none.
const CLOSE_EVENT_VERB = {
  fulfilled: 'Closed as fulfilled',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

// The recommendation-side trail entry for a close-out. Names the cause, because
// on the recommendation itself there is otherwise nothing to distinguish this
// from an admin resolving it by hand.
const CLOSE_OUT_EVENT_ACTION =
  'Status set to Resulted (the staffing request closed before a decision was made)';

// The one close path, for all three reasons, and the only thing that ends a
// request — nothing auto-closes, because closing writes a mandatory reason onto
// other people's records and nothing unattended can author that.
//
// `assertCanClose` owns who may use which reason (cancel: leadership only;
// fulfil/decline: admin only, and decline needs a note), so this function never
// re-implements that split. It runs on the read tier rather than
// `assertWriteAccess` for one reason: cancelling belongs to any leadership user,
// not only to the author, and the author-or-admin check would refuse a
// colleague of the person who filed it.
//
// Where the supplied note lands depends on the reason, and the two fields are
// not interchangeable:
//   cancelled → `closeNote`. Withdrawing an ask must never overwrite what an
//               admin already said about it.
//   declined  → `note` (+ `noteBy`/`noteAt`). Mandatory, and it IS the admin's
//               remark — the model enforces both the non-empty text and the
//               attribution triple.
//   fulfilled → `note` if one was given, otherwise nothing.
//
// `notPlacedReason` is the separate, shared reason written onto every candidate
// the close resolves; it is required exactly when there is at least one of them.
const closeStaffingRequest = async (user, requestId, payload = {}) => {
  assertValidObjectId(requestId, 'Staffing request');
  const request = await StaffingRequest.findById(requestId);
  if (!request) throw httpError('Staffing request not found', 404);

  assertReadAccess(user);

  const isAdmin = user.role === ROLES.ADMIN;
  const isLeadership = user.role === ROLES.LEADERSHIP;
  const note = cleanText(payload.note);
  const notPlacedReason = cleanText(payload.notPlacedReason);

  // Counted before the legality check, because whether the not-placed reason is
  // required is a fact about the request rather than about the payload.
  const positionIds = request.requestedPositions.map(
    (requestedPosition) => requestedPosition.position
  );
  const tagged = await Recommendation.find({
    staffingRequest: request._id,
    status: { $in: IN_SELECTION_STATUSES },
  })
    .select('position status')
    .lean();
  const inSelectionCount = selectCloseOutRecommendations(tagged, positionIds).length;

  try {
    assertCanClose(request, {
      isAdmin,
      isLeadership,
      reason: payload.reason,
      note,
      notPlacedReason,
      inSelectionCount,
    });
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

  // The cascade runs after the request is safely closed: if it fails, the
  // request is still shut and the close-out can be retried, whereas the reverse
  // order would resolve a dozen people for a request that stayed open.
  //
  // The trail is written in a `finally` for the same reason — a close that
  // happened must appear in the history whether or not the cascade that followed
  // it did, and a partial close-out is exactly the case someone needs the trail
  // to reconstruct. On failure `closedOutCount` is still 0, so the event names
  // the close alone rather than claiming a consequence it can't vouch for.
  let closedOutCount = 0;
  try {
    ({ closedOutCount } = await closeOutRecommendationsForDemandEnd(user, {
      staffingRequestId: request._id,
      positionIds,
      reason: notPlacedReason,
      action: CLOSE_OUT_EVENT_ACTION,
    }));
  } finally {
    const verb = CLOSE_EVENT_VERB[payload.reason];
    await logStaffingRequestEvent({
      entityId: request._id,
      userId: user._id,
      action:
        closedOutCount > 0
          ? `${verb} — ${closedOutCount} ${closedOutCount === 1 ? 'intern' : 'interns'} closed out`
          : verb,
      statusKey: 'staffing:closed',
    });
    emitStaffingNewsChanged();
  }

  await request.populate(REQUEST_POPULATE);

  return formatRequestWithLookup(request);
};

// The admin's remark on a request, attributed and stamped so leadership sees
// who said it and when. Admin-only: leadership must not be able to write a
// note onto its own ask. Saving again replaces the previous text — one note per
// request, by design, not a thread. Eventually this is saved as part of picking
// candidates (the fulfil flow); until that exists it has its own write path.
//
// Writable on a CLOSED request, and it is the only thing that is. With no
// reopen, this note is the entire remedy for a mis-close — "cancelled in error,
// refiled as #52" — and the cross-reference when demand comes back. Blocking it
// would leave a wrong record with no way to say so (ADR 0005).
const setStaffingRequestNote = async (user, requestId, payload = {}) => {
  assertValidObjectId(requestId, 'Staffing request');
  const request = await StaffingRequest.findById(requestId);
  if (!request) throw httpError('Staffing request not found', 404);

  assertReadAccess(user);
  if (user.role !== ROLES.ADMIN) {
    throw httpError('Only an admin may add a note to a staffing request', 403);
  }

  const note = cleanText(payload.note);
  if (!note) throw httpError('Note text is required', 400);

  request.note = note;
  request.noteBy = user._id;
  request.noteAt = new Date();

  await request.save();

  await logStaffingRequestEvent({
    entityId: request._id,
    userId: user._id,
    action: 'Note added',
    statusKey: 'staffing:note',
  });
  emitStaffingNewsChanged();

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
  listPutForwardCandidates,
  putInternsForward,
  closeStaffingRequest,
  getStaffingRequestNews,
  markStaffingRequestsSeen,
  getStaffingRequestHistory,
};
