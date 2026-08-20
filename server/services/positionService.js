const Position = require('../models/Position');
const Technology = require('../models/Technology');
const { slugify } = require('../helpers/slugify');
const { roleRoot, escapeRegExp } = require('../helpers/roleCatalog');

const assertNotATechnology = async (name) => {
  const root = roleRoot(name);
  const clash = await Technology.findOne({
    name: { $regex: `^${escapeRegExp(root)}$`, $options: 'i' },
  }).lean();
  if (clash) {
    const error = new Error(
      `"${name}" overlaps with the existing technology "${clash.name}" — positions are role specializations, not technologies`
    );
    error.statusCode = 409;
    throw error;
  }
};

const getAllPositions = async ({ includeInactive = false } = {}) => {
  // $ne: false (not: true) — isActive is a new field, so positions seeded before it existed
  // have no value stored for it at all. Treat "unset" as active so this doesn't hide every
  // pre-existing position the moment this ships.
  const filter = includeInactive ? {} : { isActive: { $ne: false } };
  const positions = await Position.find(filter).sort({ name: 1 }).lean();
  // .lean() skips Mongoose's default hydration too, so normalize the same "unset means
  // active" rule here for anything reading the field directly (e.g. the admin edit form).
  return positions.map((position) => ({ ...position, isActive: position.isActive !== false }));
};

const createPosition = async ({ name, slug }) => {
  if (!name?.trim()) throw new Error('Position name is required');
  await assertNotATechnology(name);
  const resolvedSlug = slugify(slug || name);
  return Position.create({ name: name.trim(), slug: resolvedSlug });
};

const updatePosition = async (id, { name, isActive }) => {
  const position = await Position.findById(id);
  if (!position) throw new Error('Position not found');

  if (name !== undefined) {
    await assertNotATechnology(name);
    position.name = name.trim();
  }
  if (isActive !== undefined) position.isActive = isActive;

  await position.save();
  return position;
};

module.exports = {
  getAllPositions,
  createPosition,
  updatePosition,
};
