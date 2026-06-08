const Technology = require('../models/Technology');
const { slugify } = require('../helpers/slugify');

const getAllTechnologies = async ({ includeInactive = false } = {}) => {
  const filter = includeInactive ? {} : { isActive: true };
  return Technology.find(filter).sort({ name: 1 }).lean();
};

const createTechnology = async ({ name, slug }) => {
  if (!name?.trim()) throw new Error('Technology name is required');
  const resolvedSlug = slugify(slug || name);
  return Technology.create({ name: name.trim(), slug: resolvedSlug });
};

const updateTechnology = async (id, { name, isActive }) => {
  const technology = await Technology.findById(id);
  if (!technology) throw new Error('Technology not found');

  if (name !== undefined) technology.name = name.trim();
  if (isActive !== undefined) technology.isActive = isActive;

  await technology.save();
  return technology;
};

module.exports = {
  getAllTechnologies,
  createTechnology,
  updateTechnology,
};
