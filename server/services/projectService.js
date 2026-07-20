const Project = require('../models/Project');
const { PROJECT_STATUSES } = require('../models/Project');
const { slugify } = require('../helpers/slugify');

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
    technologies: technologyIds || [],
  });
  return project.populate('technologies', 'name slug');
};

const updateProject = async (id, { name, client, description, status, technologyIds }) => {
  const project = await Project.findById(id);
  if (!project) throw new Error('Project not found');
  if (project.isSystem) throw new Error('This project cannot be edited');

  if (name !== undefined) project.name = name.trim();
  if (client !== undefined) project.client = client.trim();
  if (description !== undefined) project.description = description.trim();
  if (technologyIds !== undefined) project.technologies = technologyIds;
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
