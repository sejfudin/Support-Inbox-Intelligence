const mongoose = require('mongoose');
const Project = require('../models/Project');
const { PROJECT_STATUSES } = require('../models/Project');
const Technology = require('../models/Technology');
const { slugify } = require('../helpers/slugify');

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

const createProject = async ({ name, client, description, technologyIds }) => {
  if (!name?.trim()) throw new Error('Project name is required');
  const resolvedSlug = slugify(name);
  if (resolvedSlug === 'unspecified') throw new Error('This project name is reserved');

  const project = await Project.create({
    name: name.trim(),
    slug: resolvedSlug,
    client: client?.trim() || '',
    description: description?.trim() || '',
    technologies: await resolveTechnologyIds(technologyIds),
  });
  return project.populate('technologies', 'name slug');
};

const updateProject = async (id, { name, client, description, status, technologyIds }) => {
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

  await project.save();
  return project.populate('technologies', 'name slug');
};

module.exports = {
  getAllProjects,
  createProject,
  updateProject,
};
