const mongoose = require('mongoose');
const Project = require('../models/Project');
const { PROJECT_STATUSES, PROJECT_TYPES } = require('../models/Project');
const Technology = require('../models/Technology');
const Recommendation = require('../models/Recommendation');
const Position = require('../models/Position');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { slugify } = require('../helpers/slugify');
const { httpError } = require('../helpers/httpError');
const internNotificationService = require('./internNotificationService');

// Same two-role read gate as recommendations (recommendationService.js
// READ_ROLES) — leadership is stakeholder-facing read access, everyone else
// (including mentors) has no reason to see the cross-project roster/pipeline.
const assertLeadershipReadAccess = (user) => {
  if (user?.role !== ROLES.ADMIN && user?.role !== ROLES.LEADERSHIP) {
    throw httpError('Not authorized', 403);
  }
};

// Validate a project's technology tags the same way recommendations do: every
// id must be a real, active Technology. Returns the deduped id list.
const resolveTechnologyIds = async (technologyIds) => {
  const ids = [...new Set((technologyIds || []).filter(Boolean).map((id) => id.toString()))];
  if (ids.length === 0) return [];
  const allValid = ids.every((id) => mongoose.Types.ObjectId.isValid(id));
  const count = allValid
    ? await Technology.countDocuments({ _id: { $in: ids }, isActive: true })
    : 0;
  if (!allValid || count !== ids.length) {
    throw new Error('One or more technologies are invalid');
  }
  return ids;
};

// The admin must classify every project explicitly, so a missing `type` is
// rejected here rather than left to the schema: Mongoose's validation error
// wouldn't tell "omitted" apart from "misspelled" in the 400 message. One
// assertion for both create and update so the two can't drift.
const assertProjectType = (type) => {
  if (!PROJECT_TYPES.includes(type)) throw httpError('Invalid project type', 400);
};

const getAllProjects = async ({ status, includeAll = false } = {}) => {
  const filter = {};
  if (!includeAll) {
    filter.isSystem = { $ne: true };
    filter.status = status && PROJECT_STATUSES.includes(status) ? status : 'active';
  } else if (status && PROJECT_STATUSES.includes(status)) {
    filter.status = status;
  }
  return Project.find(filter).populate('technologies', 'name slug').sort({ name: 1 }).lean();
};

const createProject = async ({ name, type, client, description, technologyIds }) => {
  if (!name?.trim()) throw new Error('Project name is required');
  assertProjectType(type);
  const resolvedSlug = slugify(name);
  if (resolvedSlug === 'unspecified') throw new Error('This project name is reserved');

  const project = await Project.create({
    name: name.trim(),
    slug: resolvedSlug,
    type,
    client: client?.trim() || '',
    description: description?.trim() || '',
    technologies: await resolveTechnologyIds(technologyIds),
  });
  return project.populate('technologies', 'name slug');
};

const updateProject = async (id, { name, type, client, description, status, technologyIds }) => {
  const project = await Project.findById(id);
  if (!project) throw new Error('Project not found');
  if (project.isSystem) throw new Error('This project cannot be edited');

  if (name !== undefined) {
    // Re-slug on rename so the canonical (unique) slug tracks the name — a
    // rename that collides with another project now hits the unique index
    // (→ 409) instead of silently creating a duplicate display name.
    const resolvedSlug = slugify(name);
    if (resolvedSlug === 'unspecified') throw new Error('This project name is reserved');
    project.name = name.trim();
    project.slug = resolvedSlug;
  }
  if (client !== undefined) project.client = client.trim();
  if (description !== undefined) project.description = description.trim();
  if (technologyIds !== undefined) project.technologies = await resolveTechnologyIds(technologyIds);
  if (status !== undefined) {
    if (!PROJECT_STATUSES.includes(status)) throw new Error('Invalid project status');
    project.status = status;
  }
  if (type !== undefined) {
    assertProjectType(type);
    project.type = type;
  }

  await project.save();
  return project.populate('technologies', 'name slug');
};

const getProjectById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError('Project not found', 404);
  const project = await Project.findById(id).populate('technologies', 'name slug').lean();
  if (!project) throw httpError('Project not found', 404);
  return project;
};

const RECOMMENDATION_INTERN_POPULATE = [
  { path: 'internProfile', populate: { path: 'user', select: 'fullname email' } },
  { path: 'position', select: 'name slug' },
  { path: 'technologies', select: 'name slug' },
];

const internSummary = (recommendation) => ({
  recommendationId: recommendation._id,
  userId: recommendation.internProfile?.user?._id || null,
  fullname: recommendation.internProfile?.user?.fullname || 'Unknown',
  position: recommendation.position?.name || null,
});

// The authoritative "when this outcome happened" date: the recorded decision
// date, falling back to the resulted-stage date, falling back to the record's
// last update — same fallback chain wherever a placed/resulted date is shown.
const resolveResultDate = (recommendation) =>
  recommendation.result?.decidedAt ||
  recommendation.statusDates?.resulted ||
  recommendation.updatedAt;

// The day an intern went ONTO the project, for the placed rosters ("on this
// project since X"). Prefers the placement's own start date — the same date that
// ends their attendance obligation — so this and the attendance cut-off can never
// give two different answers for the same intern. Falls back to the decision date
// for placements recorded before start dates existed, so a legacy row still
// renders and still sorts.
//
// Note the deliberate difference from `placementExemptionDate` in
// helpers/attendanceStats.js: there, a missing start date must mean NO exemption,
// because inventing one forgives real absence. Here it only means "show the best
// date on hand". Same input, different obligations — do not unify them.
const resolvePlacementStart = (recommendation) =>
  recommendation.result?.startDate || resolveResultDate(recommendation);

// Leadership-facing roster/pipeline for one project — "which interns are on
// project X" stays a derived read (query Recommendation by project), same
// philosophy as the per-intern recommendations tab; no roster is stored on
// Project itself.
const getProjectOverview = async (id, user) => {
  assertLeadershipReadAccess(user);
  const project = await getProjectById(id);

  const recommendations = await Recommendation.find({ project: id })
    .populate(RECOMMENDATION_INTERN_POPULATE)
    .sort({ updatedAt: -1 })
    .lean();

  const placed = recommendations
    .filter((rec) => rec.result?.outcome === 'placed')
    .map((rec) => ({
      ...internSummary(rec),
      placedAt: resolvePlacementStart(rec),
    }));

  const selection = recommendations
    .filter((rec) => ['recommended', 'interviewing'].includes(rec.status))
    .map((rec) => ({
      ...internSummary(rec),
      stage: rec.status,
      technologies: (rec.technologies || []).map((t) => ({ _id: t._id, name: t.name })),
    }));

  const history = recommendations
    .filter((rec) => rec.status === 'resulted')
    .map((rec) => ({
      ...internSummary(rec),
      outcome: rec.result?.outcome || null,
      note: rec.result?.note || '',
      date: resolveResultDate(rec),
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return { project, placed, selection, history };
};

// Leadership-facing list + KPI/chart aggregate for every (non-system) project
// in one call — the list page filters/sorts/paginates this single payload
// client-side rather than round-tripping per filter change.
const getProjectsOverview = async (user) => {
  assertLeadershipReadAccess(user);

  const projects = await Project.find({ isSystem: { $ne: true } })
    .populate('technologies', 'name slug')
    .sort({ name: 1 })
    .lean();
  const projectIds = projects.map((project) => project._id);

  const recommendations = await Recommendation.find({ project: { $in: projectIds } })
    .populate(RECOMMENDATION_INTERN_POPULATE)
    .lean();

  const recsByProject = new Map();
  recommendations.forEach((rec) => {
    const key = rec.project.toString();
    if (!recsByProject.has(key)) recsByProject.set(key, []);
    recsByProject.get(key).push(rec);
  });

  const byStatus = { active: 0, on_hold: 0, completed: 0 };
  let internsPlaced = 0;
  let recommendedCount = 0;
  let interviewingCount = 0;
  const selectionInternIds = new Set();
  // technologyId -> Set(internProfileId), across every in-selection recommendation.
  const skillInternMap = new Map();
  const technologyById = new Map();
  const technologyDemandByProject = new Map();
  // Flat, cross-project rows for the KPI modals (the per-project counts above
  // aren't enough to render "who" — the modals need names/positions/dates).
  const placedInterns = [];
  const recommendedInterns = [];
  const interviewingInterns = [];

  const annotatedProjects = projects.map((project) => {
    const projectRecs = recsByProject.get(project._id.toString()) || [];
    const placedRecs = projectRecs.filter((rec) => rec.result?.outcome === 'placed');
    const placedCount = placedRecs.length;
    const selectionRecs = projectRecs.filter((rec) =>
      ['recommended', 'interviewing'].includes(rec.status)
    );

    byStatus[project.status] = (byStatus[project.status] || 0) + 1;
    internsPlaced += placedCount;

    placedRecs.forEach((rec) => {
      placedInterns.push({
        ...internSummary(rec),
        projectId: project._id,
        projectName: project.name,
        placedAt: resolvePlacementStart(rec),
      });
    });

    selectionRecs.forEach((rec) => {
      const entry = {
        ...internSummary(rec),
        projectId: project._id,
        projectName: project.name,
        projectClient: project.client,
      };
      if (rec.status === 'recommended') {
        recommendedCount += 1;
        recommendedInterns.push(entry);
      } else {
        interviewingCount += 1;
        interviewingInterns.push(entry);
      }

      const internId = rec.internProfile?._id?.toString();
      if (!internId) return;
      selectionInternIds.add(internId);
      (rec.technologies || []).forEach((tech) => {
        technologyById.set(tech._id.toString(), tech);
        if (!skillInternMap.has(tech._id.toString())) {
          skillInternMap.set(tech._id.toString(), new Set());
        }
        skillInternMap.get(tech._id.toString()).add(internId);
      });
    });

    (project.technologies || []).forEach((tech) => {
      technologyById.set(tech._id.toString(), tech);
      const key = tech._id.toString();
      if (!technologyDemandByProject.has(key)) {
        technologyDemandByProject.set(key, { projectCount: 0, internsPlacedCount: 0 });
      }
      const entry = technologyDemandByProject.get(key);
      entry.projectCount += 1;
      entry.internsPlacedCount += placedCount;
    });

    return { ...project, placedCount, inSelectionCount: selectionRecs.length };
  });

  // Full list, sorted by intern count — the KPI card shows only the top 4,
  // the "see all" modal shows the rest, both slicing the same source list.
  const skillsInSelection = [...skillInternMap.entries()]
    .map(([techId, internIds]) => ({
      technology: technologyById.get(techId),
      internCount: internIds.size,
    }))
    .sort(
      (a, b) => b.internCount - a.internCount || a.technology.name.localeCompare(b.technology.name)
    );

  const technologyDemand = [...technologyDemandByProject.entries()]
    .map(([techId, counts]) => ({ technology: technologyById.get(techId), ...counts }))
    .sort(
      (a, b) =>
        b.projectCount - a.projectCount || a.technology.name.localeCompare(b.technology.name)
    );

  placedInterns.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));

  return {
    projects: annotatedProjects,
    kpis: {
      totalProjects: projects.length,
      byStatus,
      internsPlaced,
      placedInterns,
      inSelection: {
        recommended: recommendedCount,
        interviewing: interviewingCount,
        total: recommendedCount + interviewingCount,
        internsInSelection: selectionInternIds.size,
        recommendedInterns,
        interviewingInterns,
      },
      skillsInSelection,
      technologyDemand,
    },
  };
};

/**
 * A leadership user asking admins to staff interns onto a project — the
 * first (and so far only) leadership write path in this domain; every other
 * route here is admin-only. Deliberately notify-only: no request is
 * persisted anywhere. A fuller tracked-request workflow (a queue admins can
 * mark fulfilled/dismissed) is separate, larger, future work — this is just
 * the button + the notification, so it doesn't compete with that.
 */
const requestInternsForProject = async (user, projectId, { positionId, count, note } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) throw httpError('Project not found', 404);
  const project = await Project.findById(projectId).select('name isSystem');
  if (!project || project.isSystem) throw httpError('Project not found', 404);

  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) throw httpError('Describe what you need in the note', 400);
  if (trimmedNote.length > 500) throw httpError('Note is too long (max 500 characters)', 400);

  const safeCount = count === undefined || count === null || count === '' ? null : Number(count);
  if (safeCount !== null && (!Number.isInteger(safeCount) || safeCount < 1 || safeCount > 50)) {
    throw httpError('Count must be a whole number between 1 and 50', 400);
  }

  let positionLabel = null;
  if (positionId) {
    if (!mongoose.Types.ObjectId.isValid(positionId)) throw httpError('Invalid position', 400);
    const position = await Position.findById(positionId).select('name');
    if (!position) throw httpError('Invalid position', 400);
    positionLabel = position.name;
  }

  const admins = await User.find({ role: ROLES.ADMIN, active: true, status: 'active' }).select(
    '_id'
  );

  for (const admin of admins) {
    internNotificationService.notifyInternRequestFromLeadership({
      adminUserId: admin._id,
      projectName: project.name,
      requesterName: user.fullname,
      positionLabel,
      count: safeCount,
      note: trimmedNote,
    });
  }

  return { notifiedAdmins: admins.length };
};

module.exports = {
  getAllProjects,
  createProject,
  updateProject,
  getProjectById,
  getProjectOverview,
  getProjectsOverview,
  requestInternsForProject,
};
