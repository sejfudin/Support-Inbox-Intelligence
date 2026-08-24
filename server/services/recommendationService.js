const mongoose = require('mongoose');
const Recommendation = require('../models/Recommendation');
const { RECOMMENDATION_STATUSES, RECOMMENDATION_RESULTS } = require('../models/Recommendation');
const InternProfile = require('../models/InternProfile');
const { READY_STATUS } = require('../models/InternProfile');
const Technology = require('../models/Technology');
const Position = require('../models/Position');
const Project = require('../models/Project');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { escapeRegex } = require('../helpers/escapeRegex');
const { placementExemptionDate } = require('../helpers/attendanceStats');
const { selectCloseOutRecommendations } = require('../helpers/staffingRequestRules');
const {
  assertProjectFieldAsserted,
  assertCanEditProject,
  PROJECT_TO_BE_CONFIRMED_LABEL,
} = require('../helpers/recommendationProjectRules');
const { buildCvUrl } = require('./internCvService');
const { emitInternDataChanged } = require('../socket/events');
const historyService = require('./historyService');
const { httpError } = require('../helpers/httpError');
const internNotificationService = require('./internNotificationService');
const { userSelect } = require('../constants/userSelect');

// The status milestones tracked in the append-only history log — the status
// lifecycle itself (recommended → interviewing → resulted). The placement
// outcome (placed / not placed) is a separate field surfaced as "Result", not
// a timeline step. The recommendations table shows the latest date per status.
const TRACKED_STATUS_KEYS = ['recommended', 'interviewing', 'resulted'];

const statusKeyLabel = (statusKey) =>
  ({
    recommended: 'Recommended',
    interviewing: 'Interviewing',
    resulted: 'Resulted',
  })[statusKey] || statusKey;

// Append a status-change record to the recommendation's history log. Never
// overwrites — each call is a new row, preserving the full trail even when a
// status is revisited.
const logStatusEvent = (recommendationId, userId, statusKey) =>
  historyService.logEntityEvent({
    entityType: 'recommendation',
    entityId: recommendationId,
    userId,
    statusKey,
    action: `Status set to ${statusKeyLabel(statusKey)}`,
  });

const READ_ROLES = [ROLES.ADMIN, ROLES.LEADERSHIP];

const RECOMMENDATION_POPULATE = [
  {
    path: 'internProfile',
    populate: [
      {
        path: 'user',
        select: userSelect('role', 'status', 'hub'),
        populate: { path: 'hub', select: 'name city country' },
      },
      { path: 'internshipType', select: 'name slug' },
      { path: 'primaryMentor', select: userSelect('role') },
      { path: 'secondaryMentor', select: userSelect('role') },
    ],
  },
  { path: 'position', select: 'name slug' },
  { path: 'project', select: 'name slug status isSystem' },
  { path: 'technologies', select: 'name slug' },
  { path: 'createdBy', select: userSelect('role') },
  { path: 'updatedBy', select: userSelect('role') },
  { path: 'result.decidedBy', select: userSelect('role') },
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

// Recommendations are admin-only to write — mentors (even assigned ones) can't
// create, update, or delete them.
const assertRecommendationWriteAccess = (user) => {
  if (user.role !== ROLES.ADMIN) {
    throw httpError('Not authorized to modify recommendations', 403);
  }
};

const formatUser = (user) => {
  if (!user) return null;
  return {
    _id: user._id,
    id: user._id,
    fullname: user.fullname,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || null,
    hub: user.hub || null,
  };
};

const formatInternProfile = (profile) => {
  if (!profile) return null;
  return {
    _id: profile._id,
    id: profile._id,
    user: formatUser(profile.user),
    internshipType: profile.internshipType || null,
    primaryMentor: formatUser(profile.primaryMentor),
    secondaryMentor: formatUser(profile.secondaryMentor),
    status: profile.status,
    expectedEndDate: profile.expectedEndDate || null,
    cvUrl: buildCvUrl(profile.cvPath),
  };
};

const formatRecommendation = (recommendation, statusDates = {}) => {
  const plain = recommendation.toObject ? recommendation.toObject() : recommendation;
  return {
    ...plain,
    id: plain._id,
    internProfile: formatInternProfile(plain.internProfile),
    createdBy: formatUser(plain.createdBy),
    updatedBy: formatUser(plain.updatedBy),
    result: {
      outcome: plain.result?.outcome || null,
      note: plain.result?.note || '',
      decidedAt: plain.result?.decidedAt || null,
      decidedBy: formatUser(plain.result?.decidedBy),
      // The intern's first day on the project; null while it is still unknown.
      startDate: plain.result?.startDate || null,
      // Whether this `not_placed` came from demand ending rather than from a
      // decision about the intern. The internal audience needs it at least as
      // much as the intern does: without it, a record the close-out cascade
      // wrote and a genuine rejection read identically here too, and the
      // `result.note` beside it was written about the request, not the person.
      demandEnded: Boolean(plain.result?.demandEnded),
    },
    // Date each tracked status was applied. The document's own statusDates are
    // authoritative (author-editable, support skipping interviewing); records
    // created before that field existed fall back to the append-only history
    // log. A document is "date-managed" once it has a recommended date.
    statusDates: plain.statusDates?.recommended
      ? {
          recommended: plain.statusDates.recommended,
          interviewing: plain.statusDates.interviewing || null,
          resulted: plain.statusDates.resulted || null,
        }
      : {
          recommended: statusDates.recommended || null,
          interviewing: statusDates.interviewing || null,
          resulted: statusDates.resulted || null,
        },
  };
};

const ensureTechnologyIds = async (technologyIds = []) => {
  const ids = [...new Set((technologyIds || []).filter(Boolean).map((id) => id.toString()))];

  ids.forEach((id) => assertValidObjectId(id, 'Technology'));

  if (ids.length === 0) return [];

  const count = await Technology.countDocuments({ _id: { $in: ids }, isActive: true });
  if (count !== ids.length) {
    throw httpError('One or more technologies are invalid', 400);
  }

  return ids;
};

const ensurePositionId = async (positionId) => {
  if (!positionId) {
    throw httpError('Position is required', 400);
  }

  assertValidObjectId(positionId, 'Position');

  const exists = await Position.exists({ _id: positionId });
  if (!exists) {
    throw httpError('Position is invalid', 400);
  }

  return positionId;
};

// `null` is a legal, deliberate value here — "project not known yet". Callers
// that must not accept an omitted field call `assertProjectFieldAsserted`
// first; this only validates a non-null value against the reference data.
const ensureProjectId = async (projectId) => {
  if (projectId === null) return null;

  assertValidObjectId(projectId, 'Project');

  const exists = await Project.exists({ _id: projectId });
  if (!exists) {
    throw httpError('Project is invalid', 400);
  }

  return projectId;
};

const parseDate = (value, label) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw httpError(`${label} is invalid`, 400);
  }
  return date;
};

// Dates compare by value, and either side may be null — "no date" is a real
// state here, not a missing one.
const sameInstant = (a, b) => (a && b ? new Date(a).getTime() === new Date(b).getTime() : !a && !b);

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeFeedback = (feedback = {}) => {
  const normalized = {
    summary: cleanText(feedback.summary),
    strengths: cleanText(feedback.strengths),
    concerns: cleanText(feedback.concerns),
  };

  if (feedback.rating !== undefined && feedback.rating !== null && feedback.rating !== '') {
    const rating = Number(feedback.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw httpError('Interview feedback rating must be between 1 and 5', 400);
    }
    normalized.rating = rating;
  }

  return normalized;
};

const hasInterviewContent = (interview = {}) =>
  [
    interview.company,
    interview.role,
    interview.stage,
    interview.scheduledAt,
    interview.locationNote,
    interview.feedback?.summary,
    interview.feedback?.strengths,
    interview.feedback?.concerns,
    interview.feedback?.rating,
    ...(Array.isArray(interview.interviewers) ? interview.interviewers : []),
  ].some((value) => value !== undefined && value !== null && String(value).trim() !== '');

const normalizeInterviews = (interviews = []) => {
  if (!Array.isArray(interviews)) {
    throw httpError('Interviews must be a list', 400);
  }

  return interviews.filter(hasInterviewContent).map((interview) => {
    const company = cleanText(interview.company);
    const role = cleanText(interview.role);

    if (!company) throw httpError('Interview company is required', 400);
    if (!role) throw httpError('Interview role is required', 400);

    return {
      _id:
        interview._id && mongoose.Types.ObjectId.isValid(interview._id) ? interview._id : undefined,
      company,
      role,
      stage: cleanText(interview.stage),
      scheduledAt: parseDate(interview.scheduledAt, 'Interview scheduled date'),
      interviewers: Array.isArray(interview.interviewers)
        ? interview.interviewers.map(cleanText).filter(Boolean)
        : [],
      locationNote: cleanText(interview.locationNote),
      feedback: normalizeFeedback(interview.feedback),
    };
  });
};

const assertValidStatus = (status) => {
  if (status !== undefined && !RECOMMENDATION_STATUSES.includes(status)) {
    throw httpError('Invalid recommendation status', 400);
  }
};

const assertValidOutcome = (outcome) => {
  if (outcome !== undefined && !RECOMMENDATION_RESULTS.includes(outcome)) {
    throw httpError('Invalid recommendation result', 400);
  }
};

/**
 * Resolve the per-stage dates after a create/update. Rules:
 * - Only stages up to the current status hold a date; later stages are cleared.
 * - A stage the caller dates explicitly keeps that date (author-editable).
 * - A newly reached stage with no explicit date defaults to now — except
 *   interviewing when the recommendation is already resulted (jumping straight
 *   from recommended to resulted skips interviewing).
 * - An explicit `null` for interviewing on a resulted recommendation marks the
 *   stage as skipped; recommended and resulted can never be skipped.
 */
const applyStatusDates = (recommendation, payloadDates) => {
  if (payloadDates !== undefined && (typeof payloadDates !== 'object' || payloadDates === null)) {
    throw httpError('Status dates must be an object', 400);
  }

  const currentIndex = RECOMMENDATION_STATUSES.indexOf(recommendation.status);
  const next = {};

  RECOMMENDATION_STATUSES.forEach((statusKey, index) => {
    if (index > currentIndex) return; // unreached stages carry no date

    const provided =
      payloadDates && Object.prototype.hasOwnProperty.call(payloadDates, statusKey)
        ? payloadDates[statusKey]
        : undefined;

    if (provided === null) {
      if (statusKey !== 'interviewing' || recommendation.status !== 'resulted') {
        throw httpError(
          'Only the interviewing stage of a resulted recommendation can be skipped',
          400
        );
      }
      return; // skipped — no date
    }

    if (provided !== undefined) {
      next[statusKey] = parseDate(provided, `${statusKey} date`);
      return;
    }

    const existing = recommendation.statusDates?.[statusKey];
    if (existing) {
      next[statusKey] = existing;
      return;
    }

    // Newly reached, no explicit date. Interviewing stays skipped when the
    // recommendation jumped straight to resulted.
    if (statusKey === 'interviewing' && recommendation.status === 'resulted') return;
    next[statusKey] = new Date();
  });

  // Stage dates must not run backwards (recommended ≤ interviewing ≤ resulted).
  if (next.interviewing && next.recommended && next.interviewing < next.recommended) {
    throw httpError('Interviewing date cannot be before the recommended date', 400);
  }
  if (next.resulted) {
    if (next.interviewing && next.resulted < next.interviewing) {
      throw httpError('Resulted date cannot be before the interviewing date', 400);
    }
    if (next.recommended && next.resulted < next.recommended) {
      throw httpError('Resulted date cannot be before the recommended date', 400);
    }
  }

  recommendation.statusDates = next;
};

const loadInternProfileByUserId = async (internUserId) => {
  assertValidObjectId(internUserId, 'Intern');
  const profile = await InternProfile.findOne({ user: internUserId });
  if (!profile) throw httpError('Intern profile not found', 404);
  return profile;
};

const buildAccessibleProfileIds = async (query = {}) => {
  const profileFilter = {};

  if (query.internUserId) {
    assertValidObjectId(query.internUserId, 'Intern');
    profileFilter.user = query.internUserId;
  }

  const userFilter = { role: ROLES.INTERN };

  if (query.hubId) {
    assertValidObjectId(query.hubId, 'Hub');
    userFilter.hub = query.hubId;
  }

  if (query.search) {
    const escapedSearch = escapeRegex(query.search);
    userFilter.$or = [
      { fullname: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  if (query.search || query.hubId) {
    const users = await User.find(userFilter).select('_id').lean();

    if (users.length === 0) return [];

    const userIds = users.map((candidate) => candidate._id);
    if (profileFilter.user) {
      const explicitId = profileFilter.user.toString();
      if (!userIds.some((id) => id.toString() === explicitId)) return [];
    } else {
      profileFilter.user = { $in: userIds };
    }
  }

  const needsProfileFilter =
    Boolean(query.internUserId) || Boolean(query.search) || Boolean(query.hubId);

  if (!needsProfileFilter) return null;

  const profiles = await InternProfile.find(profileFilter).select('_id').lean();
  return profiles.map((profile) => profile._id);
};

const listRecommendations = async (user, query = {}) => {
  assertReadAccess(user);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const filter = {};

  if (query.status) {
    assertValidStatus(query.status);
    filter.status = query.status;
  }

  if (query.result) {
    assertValidOutcome(query.result);
    filter['result.outcome'] = query.result;
  }

  if (query.technologyId) {
    assertValidObjectId(query.technologyId, 'Technology');
    filter.technologies = query.technologyId;
  }

  const accessibleProfileIds = await buildAccessibleProfileIds(query);
  if (accessibleProfileIds) {
    if (accessibleProfileIds.length === 0) {
      return { recommendations: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
    filter.internProfile = { $in: accessibleProfileIds };
  }

  const [recommendations, total] = await Promise.all([
    Recommendation.find(filter)
      .populate(RECOMMENDATION_POPULATE)
      // `_id` tiebreaker — `updatedAt` ties across anything touched in the same
      // bulk write, and Mongo's sort is not stable, so paging would repeat and
      // drop rows.
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Recommendation.countDocuments(filter),
  ]);

  // One aggregate for all rows on the page (avoids N+1) → { [id]: {status: date} }.
  const statusDatesById = await historyService.getLatestStatusDatesForEntities(
    'recommendation',
    recommendations.map((recommendation) => recommendation._id)
  );

  return {
    recommendations: recommendations.map((recommendation) =>
      formatRecommendation(recommendation, statusDatesById[recommendation._id.toString()] || {})
    ),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  };
};

const getRecommendation = async (user, recommendationId) => {
  assertValidObjectId(recommendationId, 'Recommendation');
  const recommendation =
    await Recommendation.findById(recommendationId).populate(RECOMMENDATION_POPULATE);

  if (!recommendation) throw httpError('Recommendation not found', 404);
  assertReadAccess(user);

  const statusDates = await historyService.getLatestStatusDates(
    'recommendation',
    recommendation._id
  );
  return formatRecommendation(recommendation, statusDates);
};

// An intern who is placed or has otherwise left the programme is no longer a
// candidate, so a new recommendation would just linger open (it is never
// counted in the pipeline KPI, which gates on live profile status).
const NON_RECOMMENDABLE_PROFILE_STATUSES = ['placed', 'completed', 'discontinued'];

const createRecommendation = async (user, payload = {}) => {
  const profile = await loadInternProfileByUserId(payload.internUserId);
  assertRecommendationWriteAccess(user);

  if (NON_RECOMMENDABLE_PROFILE_STATUSES.includes(profile.status)) {
    throw httpError(`Cannot recommend an intern who is ${profile.status}`, 409);
  }

  assertValidStatus(payload.status);
  // The timeline only moves forward from Recommended — later stages are set by
  // updating the recommendation, so each milestone gets a date.
  if (payload.status !== undefined && payload.status !== 'recommended') {
    throw httpError('A new recommendation must start as Recommended', 400);
  }
  const position = await ensurePositionId(payload.positionId);
  try {
    assertProjectFieldAsserted(payload.projectId);
  } catch (error) {
    throw httpError(error.message, 400);
  }
  const project = await ensureProjectId(payload.projectId);
  const technologies = await ensureTechnologyIds(payload.technologyIds);
  const interviews = normalizeInterviews(payload.interviews || []);

  const recommendation = await Recommendation.create({
    internProfile: profile._id,
    createdBy: user._id,
    updatedBy: user._id,
    position,
    project,
    technologies,
    status: 'recommended',
    recommendationNote: cleanText(payload.recommendationNote),
    interviews,
    statusDates: {
      // Defaults to today; the author may backdate it at creation.
      recommended: parseDate(payload.statusDates?.recommended, 'recommended date') || new Date(),
    },
  });

  // Append the initial status to the history log (append-only trail).
  await logStatusEvent(recommendation._id, user._id, recommendation.status);

  await recommendation.populate(RECOMMENDATION_POPULATE);
  emitInternDataChanged();

  internNotificationService.notifyRecommendationCreated({
    internUserId: profile.user,
    internProfileId: profile._id,
    position: recommendation.position?.name,
    project: recommendation.project?.name,
  });

  const statusDates = await historyService.getLatestStatusDates(
    'recommendation',
    recommendation._id
  );
  return formatRecommendation(recommendation, statusDates);
};

// Putting interns forward against a staffing request creates ordinary
// recommendations — the whole point of the design is that there is no parallel
// concept, so the existing pipeline, placement and attendance behaviour all
// apply untouched. It lives here rather than in staffingRequestService because
// what a freshly created recommendation needs (an initial status event, the
// intern-data invalidation) is knowledge that belongs to this module.
//
// Two deliberate differences from `createRecommendation`:
//   - `position` is forced to the requested position it is created against,
//     never taken from a payload;
//   - an already-placed intern is allowed through. `NON_RECOMMENDABLE_PROFILE_
//     STATUSES` guards the ad-hoc flow, where offering a placed intern is
//     almost always a slip. Here it is a deliberate act the admin was warned
//     about, and refusing it would only push them to edit recommendations by
//     hand. Discontinued and completed interns are still refused — that
//     exclusion is enforced by the caller's picker rules.
// Takes every requested position in one call rather than one call per position:
// an admin submits their staged picks as a single act, so the recommendations
// behind it are inserted in one write and either all appear or none do.
const createRecommendationsForStaffingRequest = async (
  user,
  { groups = [], projectId, staffingRequestId }
) => {
  assertRecommendationWriteAccess(user);
  try {
    assertProjectFieldAsserted(projectId);
  } catch (error) {
    throw httpError(error.message, 400);
  }

  const recommendedAt = new Date();
  const pending = groups.flatMap(({ positionId, internProfileIds, technologyIds = [] }) =>
    internProfileIds.map((internProfileId) => ({
      document: {
        internProfile: internProfileId,
        createdBy: user._id,
        updatedBy: user._id,
        position: positionId,
        project: projectId,
        staffingRequest: staffingRequestId,
        technologies: technologyIds,
        status: 'recommended',
        statusDates: { recommended: recommendedAt },
      },
      internProfileId,
      positionId,
    }))
  );
  const created = await Recommendation.insertMany(pending.map(({ document }) => document));

  await Promise.all(
    created.map((recommendation) =>
      logStatusEvent(recommendation._id, user._id, recommendation.status)
    )
  );
  emitInternDataChanged();

  // `insertMany` bypasses the populated document returned by the ad-hoc create
  // path, so resolve the small label/recipient lookup in bulk and fan out the
  // same notification explicitly. Keeping it here makes every recommendation
  // creation path uphold the same user-facing contract.
  try {
    const [profiles, positions, project] = await Promise.all([
      InternProfile.find({ _id: { $in: pending.map((item) => item.internProfileId) } })
        .select('_id user')
        .lean(),
      Position.find({ _id: { $in: pending.map((item) => item.positionId) } })
        .select('_id name')
        .lean(),
      Project.findById(projectId).select('name').lean(),
    ]);
    const profilesById = new Map(profiles.map((profile) => [String(profile._id), profile]));
    const positionsById = new Map(positions.map((position) => [String(position._id), position]));
    for (const item of pending) {
      const profile = profilesById.get(String(item.internProfileId));
      if (!profile?.user) continue;
      internNotificationService.notifyRecommendationCreated({
        internUserId: profile.user,
        internProfileId: profile._id,
        position: positionsById.get(String(item.positionId))?.name,
        project: project?.name,
      });
    }
  } catch (err) {
    console.error('[recommendationService] bulk notification lookup failed:', err.message);
  }

  return created;
};

const applyResultPayload = (recommendation, payloadResult, user) => {
  if (!payloadResult || typeof payloadResult !== 'object') return;

  const outcome = payloadResult.outcome ?? recommendation.result?.outcome;
  assertValidOutcome(outcome);

  const note =
    payloadResult.note !== undefined
      ? cleanText(payloadResult.note)
      : recommendation.result?.note || '';

  if (outcome && !note) {
    throw httpError('Result note is required', 400);
  }

  // The start date is a straight passthrough: omit it to leave the recorded one
  // alone, send a date to set or move it, send null to clear it back to
  // "unknown". No default is invented here — the form prefills the field with the
  // Resulted date, so an empty one arriving at this point was emptied on purpose,
  // and refilling it would overrule the admin. Not constrained relative to the
  // stage dates either: an intern can have started before anyone recorded the
  // placement, so a start date earlier than the Resulted date is legitimate.
  const startDate =
    payloadResult.startDate === undefined
      ? recommendation.result?.startDate
      : parseDate(payloadResult.startDate, 'Start date');

  recommendation.result = {
    outcome,
    note,
    decidedAt: outcome ? new Date() : undefined,
    decidedBy: outcome ? user._id : undefined,
    // Only a placement has a start date — reversing the outcome drops it.
    startDate: outcome === 'placed' ? startDate : undefined,
    // `demandEnded` is never read off the payload, whatever it contains: an
    // admin who could set it would be able to tell a rejected intern their
    // opportunity was withdrawn, and only the close-out cascade knows that it
    // was. The stored flag is carried over while the record stays `not_placed`
    // — editing the note on a closed-out record must not silently turn it into
    // an ordinary rejection — and dropped the moment the outcome changes, since
    // whatever the new outcome is, it was decided by a person.
    demandEnded: outcome === 'not_placed' ? Boolean(recommendation.result?.demandEnded) : false,
  };

  if (outcome) {
    recommendation.status = 'resulted';
  }
};

const ACTIVE_PIPELINE_STATUSES = ['recommended', 'interviewing'];

// Resolve one live recommendation as `not_placed` on someone else's initiative
// — a placement elsewhere, or the demand behind it ending. Written per document
// rather than as a blind updateMany so each one also gets its append-only
// history row and a complete set of statusDates: otherwise the table
// (history-backed for legacy records) and the cards disagree on the Resulted
// date, and the audit trail silently misses the close.
//
// `demandEnded` is the one thing that separates the two callers on the intern's
// own dashboard, so it is passed in explicitly rather than inferred here.
const resolveAsNotPlaced = async (recommendation, user, { note, demandEnded, action, now }) => {
  const set = {
    status: 'resulted',
    result: {
      outcome: 'not_placed',
      note,
      decidedAt: now,
      decidedBy: user._id,
      demandEnded,
    },
    updatedBy: user._id,
  };

  if (recommendation.statusDates?.recommended) {
    // Stamp the stage date so the auto-close shows on the status timeline
    // like any other resulted recommendation.
    set['statusDates.resulted'] = now;
  } else {
    // Records that predate statusDates: seed the earlier stages from the
    // history log (same as updateRecommendation) so the document carries a
    // complete set, not just the resulted date.
    const historyDates = await historyService.getLatestStatusDates(
      'recommendation',
      recommendation._id
    );
    const statusDates = {
      recommended: historyDates.recommended || recommendation.createdAt,
      resulted: now,
    };
    if (historyDates.interviewing) statusDates.interviewing = historyDates.interviewing;
    set.statusDates = statusDates;
  }

  // updateOne (not save) so legacy documents missing the now-required
  // position/project fields aren't blocked by model validation.
  await Recommendation.updateOne({ _id: recommendation._id }, { $set: set });

  await historyService.logEntityEvent({
    entityType: 'recommendation',
    entityId: recommendation._id,
    userId: user._id,
    statusKey: 'resulted',
    action,
  });
};

// A placed intern is out of the pipeline: any of their still-open
// recommendations are moot, so resolve them as not_placed with an
// explanatory note. Idempotent — interns with no open recommendations
// are untouched.
const closeActiveRecommendationsForIntern = async (
  internProfileId,
  user,
  { excludeRecommendationId = null } = {}
) => {
  const filter = {
    internProfile: internProfileId,
    status: { $in: ACTIVE_PIPELINE_STATUSES },
  };
  if (excludeRecommendationId) filter._id = { $ne: excludeRecommendationId };

  const toClose = await Recommendation.find(filter).select('_id status statusDates createdAt');
  const now = new Date();

  for (const recommendation of toClose) {
    await resolveAsNotPlaced(recommendation, user, {
      note: 'Closed automatically because the intern was placed.',
      // The intern was placed — that IS a decision about them, and the
      // opportunity they lost was lost to their own better one.
      demandEnded: false,
      action: 'Status set to Resulted (closed automatically because the intern was placed)',
      now,
    });
  }
};

// The intern is no longer in a process, so they belong back on the ready bench
// owing attendance again — the same reset `updateRecommendation` runs inline for
// an admin's own not_placed decision.
//
// Scoped to `active` profiles, which is where that reset and this one differ, on
// purpose: an admin resolving someone's own recommendation as not_placed is
// undoing that person's placement, but this cascade only ever touches processes
// the intern was still *in*. Someone already `placed` is placed on something
// else, and demand ending elsewhere must not take that away — nor the
// attendance exemption that rides on it.
const returnInternsToBench = async (internProfileIds) => {
  const profiles = await InternProfile.find({
    _id: { $in: internProfileIds },
    status: 'active',
  });

  for (const profile of profiles) {
    profile.status = READY_STATUS;
    profile.placedAt = null;
    await profile.save();
  }
};

/**
 * The close-out cascade: everyone still in selection for demand that has ended
 * is resolved as `not_placed`, marked `demandEnded`, with one shared reason.
 *
 * Called when a staffing request is closed for any of its three reasons, and
 * (ticket 10) when a requested position is changed or removed — hence
 * `positionIds`, which narrows the cascade to the positions whose demand
 * actually went away. Placed interns are never touched, because placement is a
 * fact about the intern rather than about the demand.
 *
 * The actor may be a leadership user, not only an admin: cancelling is
 * leadership-only, and this is the one path on which a non-admin writes to
 * recommendations. `result.decidedBy` records them, which is correct — they did
 * decide it (see `.claude/docs/security.md`).
 *
 * Returns how many records were closed out, which is what the caller names in
 * the request's history event.
 */
const closeOutRecommendationsForDemandEnd = async (
  user,
  { staffingRequestId, positionIds, reason, action }
) => {
  const tagged = await Recommendation.find({
    staffingRequest: staffingRequestId,
    status: { $in: ACTIVE_PIPELINE_STATUSES },
  }).select('_id internProfile position project status statusDates createdAt');

  const toCloseOut = selectCloseOutRecommendations(tagged, positionIds);
  if (toCloseOut.length === 0) return { closedOutCount: 0 };

  const now = new Date();
  for (const recommendation of toCloseOut) {
    await resolveAsNotPlaced(recommendation, user, {
      note: reason,
      demandEnded: true,
      action,
      now,
    });
  }

  await returnInternsToBench([
    ...new Set(toCloseOut.map((recommendation) => String(recommendation.internProfile))),
  ]);

  emitInternDataChanged();

  try {
    const [profiles, projects] = await Promise.all([
      InternProfile.find({
        _id: { $in: toCloseOut.map((recommendation) => recommendation.internProfile) },
      })
        .select('_id user')
        .lean(),
      Project.find({ _id: { $in: toCloseOut.map((recommendation) => recommendation.project) } })
        .select('_id name')
        .lean(),
    ]);
    const profilesById = new Map(profiles.map((profile) => [String(profile._id), profile]));
    const projectsById = new Map(projects.map((project) => [String(project._id), project]));
    for (const recommendation of toCloseOut) {
      const profile = profilesById.get(String(recommendation.internProfile));
      if (!profile?.user) continue;
      internNotificationService.notifyRecommendationNotPlaced({
        internUserId: profile.user,
        internProfileId: profile._id,
        project: projectsById.get(String(recommendation.project))?.name,
      });
    }
  } catch (err) {
    console.error('[recommendationService] close-out notification lookup failed:', err.message);
  }

  return { closedOutCount: toCloseOut.length };
};

const updateRecommendation = async (user, recommendationId, payload = {}) => {
  assertValidObjectId(recommendationId, 'Recommendation');
  const recommendation = await Recommendation.findById(recommendationId);
  if (!recommendation) throw httpError('Recommendation not found', 404);

  const profile = await InternProfile.findById(recommendation.internProfile);
  if (!profile) throw httpError('Intern profile not found', 404);

  assertRecommendationWriteAccess(user);

  // Snapshot the status BEFORE mutating so we append a history record only on an
  // actual status change (append-only — never overwrite an existing record),
  // and so the placement notification below fires only on the intern's actual
  // transition into "placed", not on every subsequent edit to an already-
  // placed recommendation (e.g. nudging the start date).
  const previousStatus = recommendation.status;
  const wasPlacedBefore = profile.status === 'placed';

  if (payload.positionId !== undefined) {
    recommendation.position = await ensurePositionId(payload.positionId);
  }

  if (payload.projectId !== undefined) {
    const nextProjectId = await ensureProjectId(payload.projectId);
    try {
      assertCanEditProject({
        status: previousStatus,
        currentProjectId: recommendation.project,
        nextProjectId,
      });
    } catch (error) {
      throw httpError(error.message, 400);
    }
    recommendation.project = nextProjectId;
  }

  if (payload.technologyIds !== undefined) {
    recommendation.technologies = await ensureTechnologyIds(payload.technologyIds);
  }

  if (payload.status !== undefined) {
    assertValidStatus(payload.status);
    // The timeline only moves forward — completed stages can't be re-selected.
    if (
      RECOMMENDATION_STATUSES.indexOf(payload.status) <
      RECOMMENDATION_STATUSES.indexOf(recommendation.status)
    ) {
      throw httpError('Recommendation status can only move forward', 400);
    }
    recommendation.status = payload.status;
  }

  if (payload.recommendationNote !== undefined) {
    recommendation.recommendationNote = cleanText(payload.recommendationNote);
  }

  if (payload.interviews !== undefined) {
    recommendation.interviews = normalizeInterviews(payload.interviews);
  }

  applyResultPayload(recommendation, payload.result, user);

  // Records created before statusDates existed on the document: seed from the
  // history log so editing them doesn't reset their historical dates to today.
  if (!recommendation.statusDates?.recommended) {
    const historyDates = await historyService.getLatestStatusDates(
      'recommendation',
      recommendation._id
    );
    recommendation.statusDates = {
      recommended: historyDates.recommended || recommendation.createdAt,
      interviewing: historyDates.interviewing,
      resulted: historyDates.resulted,
    };
  }

  applyStatusDates(recommendation, payload.statusDates);
  recommendation.updatedBy = user._id;

  await recommendation.save();

  // Keep the intern's placement status in sync with the outcome: "placed"
  // marks the profile placed; "not placed" puts the intern back on the bench
  // (ready for a new placement). Terminal statuses are never touched.
  const outcome = recommendation.result?.outcome;
  const justPlaced = outcome === 'placed' && !wasPlacedBefore;
  const justNotPlaced = outcome === 'not_placed' && ['active', 'placed'].includes(profile.status);
  if (outcome === 'placed') {
    let dirty = false;
    if (profile.status !== 'placed') {
      profile.status = 'placed';
      dirty = true;
    }
    // Going onto a project ends the attendance obligation, so stamp `placedAt` —
    // otherwise the intern silently accrues absence for every working day after
    // they leave.
    //
    // The day that happens is the placement's START DATE, and only that: see
    // `placementExemptionDate` for why neither the Resulted date nor
    // `result.decidedAt` will do. A placement whose start date is still unknown
    // exempts nothing, which is the point — the intern is placed on paper but
    // has not left the programme yet.
    //
    // Re-derived on every result update rather than only when empty, so moving
    // the start date moves the exemption with it, in both directions and however
    // many times the date slips. (An intern with no recommendation at all is
    // still exempted by setting `placedAt` directly via internService.)
    const exemptFrom = placementExemptionDate(recommendation.result);
    if (!sameInstant(profile.placedAt, exemptFrom)) {
      profile.placedAt = exemptFrom;
      dirty = true;
    }
    if (dirty) await profile.save();
    // Note: the intern's OTHER open recommendations are intentionally left
    // untouched — each recommendation is resolved individually by the mentor.
  } else if (outcome === 'not_placed' && ['active', 'placed'].includes(profile.status)) {
    profile.status = READY_STATUS;
    // Back on the bench: they owe attendance again, so the exemption is lifted.
    profile.placedAt = null;
    await profile.save();
  }

  // Append-only status history: log a new row whenever the tracked status
  // actually changes (recommended → interviewing → resulted). The row is never
  // overwritten, so prior status dates are preserved even if status moves back.
  if (
    recommendation.status !== previousStatus &&
    TRACKED_STATUS_KEYS.includes(recommendation.status)
  ) {
    await logStatusEvent(recommendation._id, user._id, recommendation.status);
  }

  await recommendation.populate(RECOMMENDATION_POPULATE);
  // Covers the direct update and any auto-closed sibling recommendations —
  // the invalidation is a single global "intern data changed" broadcast.
  emitInternDataChanged();

  const recipient = { internUserId: profile.user, internProfileId: profile._id };
  if (justPlaced) {
    internNotificationService.notifyInternPlaced({
      ...recipient,
      position: recommendation.position?.name,
      project: recommendation.project?.name,
      startDate: recommendation.result?.startDate,
    });
  } else if (justNotPlaced) {
    internNotificationService.notifyRecommendationNotPlaced({
      ...recipient,
      project: recommendation.project?.name,
    });
  } else if (recommendation.status !== previousStatus && recommendation.status === 'interviewing') {
    internNotificationService.notifyRecommendationStatusChanged({
      ...recipient,
      project: recommendation.project?.name,
      newStatus: recommendation.status,
    });
  }

  const statusDates = await historyService.getLatestStatusDates(
    'recommendation',
    recommendation._id
  );
  return formatRecommendation(recommendation, statusDates);
};

const deleteRecommendation = async (user, recommendationId) => {
  assertValidObjectId(recommendationId, 'Recommendation');
  const recommendation = await Recommendation.findById(recommendationId);
  if (!recommendation) throw httpError('Recommendation not found', 404);

  const profile = await InternProfile.findById(recommendation.internProfile);
  if (!profile) throw httpError('Intern profile not found', 404);

  // Same rule as writes: admin-only.
  assertRecommendationWriteAccess(user);

  await Recommendation.deleteOne({ _id: recommendation._id });
  // Remove the recommendation's status trail too — it has no other consumer.
  await historyService.deleteEntityHistory('recommendation', recommendation._id);

  // The intern's placement state follows the MOST RECENT recommendation, so
  // recompute it from the newest remaining record: a Placed outcome keeps the
  // intern placed, anything else (no outcome, not placed, or no recommendation
  // left at all) returns them to the bench as ready. Manual lifecycle states
  // (active/completed/discontinued) are never touched here.
  if (['placed', READY_STATUS].includes(profile.status)) {
    const latest = await Recommendation.findOne({ internProfile: profile._id })
      .sort({ updatedAt: -1 })
      .select('result.outcome result.startDate')
      .lean();
    const nextStatus = latest?.result?.outcome === 'placed' ? 'placed' : READY_STATUS;
    // `placedAt` is a cache of the placing recommendation's start date, so it has
    // to be recomputed from the same record the status is — not left behind.
    // Otherwise deleting the recommendation that placed someone leaves them
    // exempt from attendance forever with nothing left to explain why, while the
    // delete dialog promises the opposite ("will set them back to Ready for a new
    // placement"). A stale exemption inflates their attendance rate silently.
    const nextPlacedAt = placementExemptionDate(latest?.result);
    if (profile.status !== nextStatus || !sameInstant(profile.placedAt, nextPlacedAt)) {
      const previousStatus = profile.status;
      profile.status = nextStatus;
      profile.placedAt = nextPlacedAt;
      await profile.save();

      if (nextStatus !== previousStatus) {
        internNotificationService.notifyInternStatusChanged({
          internUserId: profile.user,
          internProfileId: profile._id,
          newStatus: nextStatus,
        });
      }
    }
  }

  emitInternDataChanged();

  // Enough shape for the frontend cache invalidation (id + intern user id).
  return { _id: recommendation._id, internProfile: { user: profile.user } };
};

/**
 * The redacted shape an intern sees of their *own* recommendation.
 *
 * Shown: which project and position, which stage the record is at and when it
 * got there, the scheduled interviews, the final outcome, and — once they are
 * placed — the day they start. That is the lifecycle the intern is living
 * through and the whole content of the dashboard's "My pipeline" card. The start
 * date is a fact about the intern's own schedule, unlike the notes below, which
 * are written *about* them.
 *
 * Withheld, deliberately: `recommendationNote` (the admin's internal pitch for
 * this intern), `interviews[].feedback` (the interviewer's write-up, including a
 * `concerns` field), and `result.note` (the reasoning behind a placement
 * decision). All three are written *about* the intern for an internal audience.
 * Fields are picked rather than deleted so a field added to the model later
 * cannot leak in by default.
 */
const formatOwnRecommendation = (recommendation, historyDates = {}) => {
  const dates = recommendation.statusDates?.recommended ? recommendation.statusDates : historyDates;

  return {
    id: recommendation._id,
    status: recommendation.status,
    statusDates: {
      recommended: dates.recommended || null,
      interviewing: dates.interviewing || null,
      resulted: dates.resulted || null,
    },
    position: recommendation.position?.name || '',
    // `recommendation.project` is populated by `listOwnRecommendations` above,
    // so a `null` here means the project genuinely isn't known yet, not a
    // failed populate. An intern reads this as a stated fact about the
    // record, never a blank field.
    project: recommendation.project?.name || PROJECT_TO_BE_CONFIRMED_LABEL,
    technologies: (recommendation.technologies || []).map((tech) => ({
      id: tech._id,
      name: tech.name,
    })),
    interviews: (recommendation.interviews || []).map((interview) => ({
      company: interview.company,
      role: interview.role,
      stage: interview.stage || '',
      scheduledAt: interview.scheduledAt || null,
    })),
    result: {
      outcome: recommendation.result?.outcome || null,
      decidedAt: recommendation.result?.decidedAt || null,
      startDate: recommendation.result?.startDate || null,
      // `result.note` stays withheld here, as it always has: the reason behind
      // a close-out is written for admins, leadership and mentors. This boolean
      // is what the intern gets instead, and it carries no free text — with it
      // their card says the opportunity closed before a decision was made about
      // them, without it "not placed" would claim they were turned down.
      demandEnded: Boolean(recommendation.result?.demandEnded),
    },
    updatedAt: recommendation.updatedAt,
  };
};

/**
 * The signed-in intern's own recommendations, most recently updated first.
 *
 * A deliberate, narrow exception to the admin/leadership-only rule that
 * `assertReadAccess` enforces everywhere else in this service: an intern may
 * read their own pipeline, and only through `formatOwnRecommendation`'s redacted
 * shape. The intern is resolved from the authenticated user, never from a
 * parameter, so there is nothing to tamper with — see `.claude/docs/security.md`.
 */
const listOwnRecommendations = async (user) => {
  if (user.role !== ROLES.INTERN) {
    throw httpError('Not authorized', 403);
  }

  const profile = await InternProfile.findOne({ user: user._id }).select('_id').lean();
  if (!profile) return [];

  const recommendations = await Recommendation.find({ internProfile: profile._id })
    .sort({ updatedAt: -1 })
    .populate([
      { path: 'position', select: 'name' },
      { path: 'project', select: 'name' },
      { path: 'technologies', select: 'name' },
    ])
    .lean();

  if (recommendations.length === 0) return [];

  // Records written before `statusDates` existed fall back to the append-only
  // history log — batched for all of them at once rather than per record.
  const legacyIds = recommendations
    .filter((rec) => !rec.statusDates?.recommended)
    .map((rec) => rec._id);
  const historyByRec = legacyIds.length
    ? await historyService.getLatestStatusDatesForEntities('recommendation', legacyIds)
    : {};

  return recommendations.map((rec) =>
    formatOwnRecommendation(rec, historyByRec[rec._id.toString()] || {})
  );
};

module.exports = {
  listRecommendations,
  getRecommendation,
  createRecommendation,
  createRecommendationsForStaffingRequest,
  updateRecommendation,
  deleteRecommendation,
  closeActiveRecommendationsForIntern,
  closeOutRecommendationsForDemandEnd,
  listOwnRecommendations,
};
