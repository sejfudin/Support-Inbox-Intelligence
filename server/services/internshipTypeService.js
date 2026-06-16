const InternshipType = require('../models/InternshipType');
const { slugify } = require('../helpers/slugify');

const getAllInternshipTypes = async ({ includeInactive = false } = {}) => {
  const filter = includeInactive ? {} : { isActive: true };
  return InternshipType.find(filter).sort({ name: 1 }).lean();
};

const createInternshipType = async ({ name, slug, description = '' }) => {
  if (!name?.trim()) throw new Error('Internship type name is required');
  const resolvedSlug = slugify(slug || name);
  return InternshipType.create({
    name: name.trim(),
    slug: resolvedSlug,
    description: description.trim(),
  });
};

const updateInternshipType = async (id, { name, description, isActive }) => {
  const internshipType = await InternshipType.findById(id);
  if (!internshipType) throw new Error('Internship type not found');

  if (name !== undefined) internshipType.name = name.trim();
  if (description !== undefined) internshipType.description = description.trim();
  if (isActive !== undefined) internshipType.isActive = isActive;

  await internshipType.save();
  return internshipType;
};

module.exports = {
  getAllInternshipTypes,
  createInternshipType,
  updateInternshipType,
};
