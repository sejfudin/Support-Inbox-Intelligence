const Technology = require('../models/Technology');
const Position = require('../models/Position');
const { slugify } = require('../helpers/slugify');
const { roleRoot } = require('../helpers/roleCatalog');
const { httpError } = require('../helpers/httpError');
const { TECHNOLOGY_CATEGORIES, DEFAULT_TECHNOLOGY_CATEGORY } = require('../constants/technologies');

// An unknown category would land in the catalog as an invisible row: neither search box
// filters for it, so nobody could ever declare it. Reject instead of coercing.
const resolveCategory = (category) => {
  if (category === undefined) return DEFAULT_TECHNOLOGY_CATEGORY;
  if (!TECHNOLOGY_CATEGORIES.includes(category)) {
    throw httpError(`Category must be one of: ${TECHNOLOGY_CATEGORIES.join(', ')}`, 400);
  }
  return category;
};

// Technologies are concrete tools/languages/frameworks; positions are role specializations.
// Someone naming a technology after the bare discipline ("DevOps") is really describing a
// position — block it there instead of letting the catalogs drift apart. See roleCatalog.js.
const assertNotAPosition = async (name) => {
  const candidate = name.trim().toLowerCase();
  const positions = await Position.find({}).select('name').lean();
  const clash = positions.find((position) => roleRoot(position.name) === candidate);
  if (clash) {
    const error = new Error(
      `"${name}" overlaps with the existing position "${clash.name}" — technologies should be concrete tools, languages, or frameworks, not specializations`
    );
    error.statusCode = 409;
    throw error;
  }
};

const getAllTechnologies = async ({ includeInactive = false } = {}) => {
  const filter = includeInactive ? {} : { isActive: true };
  return Technology.find(filter).sort({ name: 1 }).lean();
};

const createTechnology = async ({ name, slug, category }) => {
  if (!name?.trim()) throw new Error('Technology name is required');
  await assertNotAPosition(name);
  const resolvedSlug = slugify(slug || name);
  return Technology.create({
    name: name.trim(),
    slug: resolvedSlug,
    category: resolveCategory(category),
  });
};

const updateTechnology = async (id, { name, isActive, category }) => {
  const technology = await Technology.findById(id);
  if (!technology) throw new Error('Technology not found');

  if (name !== undefined) {
    await assertNotAPosition(name);
    technology.name = name.trim();
  }
  if (category !== undefined) technology.category = resolveCategory(category);
  if (isActive !== undefined) technology.isActive = isActive;

  await technology.save();
  return technology;
};

module.exports = {
  getAllTechnologies,
  createTechnology,
  updateTechnology,
};
