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
const { buildCvUrl } = require('./internCvService');
const { emitInternDataChanged } = require('../socket/events');
const historyService = require('./historyService');
const { httpError } = require('../helpers/httpError');

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
        select: 'fullname email status role hub',
        populate: { path: 'hub', select: 'name city country' },
      },
      { path: 'internshipType', select: 'name slug' },
      { path: 'primaryMentor', select: 'fullname email role' },
      { path: 'secondaryMentor', select: 'fullname email role' },
    ],
  },
  { path: 'position', select: 'name slug' },
  { path: 'project', select: 'name slug status isSystem' },
  { path: 'technologies', select: 'name slug' },
  { path: 'createdBy', select: 'fullname email role' },
  { path: 'updatedBy', select: 'fullname email role' },
  { path: 'result.decidedBy', select: 'fullname email role' },
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

const ensureProjectId = async (projectId) => {
  if (!projectId) {
    throw httpError('Project is required', 400);
  }

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

  const recommendedAt = new Date();
  const created = await Recommendation.insertMany(
    groups.flatMap(({ positionId, internProfileIds, technologyIds = [] }) =>
      internProfileIds.map((internProfileId) => ({
        internProfile: internProfileId,
        createdBy: user._id,
        updatedBy: user._id,
        position: positionId,
        project: projectId,
        staffingRequest: staffingRequestId,
        technologies: technologyIds,
        status: 'recommended',
        statusDates: { recommended: recommendedAt },
      }))
    )
  );

  await Promise.all(
    created.map((recommendation) =>
      logStatusEvent(recommendation._id, user._id, recommendation.status)
    )
  );
  emitInternDataChanged();

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
  };

  if (outcome) {
    recommendation.status = 'resulted';
  }
};

const ACTIVE_PIPELINE_STATUSES = ['recommended', 'interviewing'];

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

  // Per-document (not a blind updateMany) so each auto-close also gets its
  // append-only history row and complete statusDates — otherwise the table
  // (history-backed for legacy records) and the cards disagree on the
  // Resulted date, and the audit trail silently misses the close.
  const toClose = await Recommendation.find(filter).select('_id status statusDates createdAt');
  const now = new Date();

  for (const recommendation of toClose) {
    const set = {
      status: 'resulted',
      result: {
        outcome: 'not_placed',
        note: 'Closed automatically because the intern was placed.',
        decidedAt: now,
        decidedBy: user._id,
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
      action: 'Status set to Resulted (closed automatically because the intern was placed)',
    });
  }
};

const updateRecommendation = async (user, recommendationId, payload = {}) => {
  assertValidObjectId(recommendationId, 'Recommendation');
  const recommendation = await Recommendation.findById(recommendationId);
  if (!recommendation) throw httpError('Recommendation not found', 404);

  const profile = await InternProfile.findById(recommendation.internProfile);
  if (!profile) throw httpError('Intern profile not found', 404);

  assertRecommendationWriteAccess(user);

  // Snapshot the status BEFORE mutating so we append a history record only on an
  // actual status change (append-only — never overwrite an existing record).
  const previousStatus = recommendation.status;

  if (payload.positionId !== undefined) {
    recommendation.position = await ensurePositionId(payload.positionId);
  }

  if (payload.projectId !== undefined) {
    recommendation.project = await ensureProjectId(payload.projectId);
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
      profile.status = nextStatus;
      profile.placedAt = nextPlacedAt;
      await profile.save();
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
    project: recommendation.project?.name || '',
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
  listOwnRecommendations,
};
