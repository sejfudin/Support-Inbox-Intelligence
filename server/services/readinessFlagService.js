const Technology = require('../models/Technology');
const Position = require('../models/Position');
const ReadinessFlag = require('../models/ReadinessFlag');
const InternProfile = require('../models/InternProfile');
const { READINESS_LEVELS } = require('../models/ReadinessFlag');
const { ROLES } = require('../constants/roles');
const { assertInternAccess } = require('../helpers/internAccess');

const listReadinessFlags = async (user, internUserId) => {
  const profile = await assertInternAccess(user, internUserId);

  // Readiness is admin-only — mentors and interns can't view it.
  if (user.role === ROLES.INTERN || user.role === ROLES.MENTOR) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const flags = await ReadinessFlag.find({ internProfile: profile._id })
    .populate('technology', 'name slug')
    .populate('position', 'name slug')
    .populate('setBy', 'fullname')
    .sort({ 'technology.name': 1 });

  return flags.map((flag) => {
    const plain = flag.toObject();
    return { ...plain, id: plain._id };
  });
};

const upsertReadinessFlag = async (user, internUserId, { technologyId, positionId, level }) => {
  const profile = await assertInternAccess(user, internUserId, { write: true });

  if (user.role !== ROLES.ADMIN) {
    const err = new Error('Not authorized to set readiness');
    err.statusCode = 403;
    throw err;
  }

  if (!technologyId && !positionId) throw new Error('Technology or position is required');
  if (technologyId && positionId) throw new Error('Provide a technology or a position, not both');
  if (!READINESS_LEVELS.includes(level)) throw new Error('Invalid readiness level');

  let filter;
  const update = { level, setBy: user._id };

  if (technologyId) {
    const technology = await Technology.findOne({ _id: technologyId, isActive: true });
    if (!technology) throw new Error('Invalid technology');
    filter = { internProfile: profile._id, technology: technologyId };
  } else {
    const position = await Position.findById(positionId);
    if (!position) throw new Error('Invalid position');
    // An intern holds a single role, so the role flag is a singleton per
    // profile — it gets rewritten in place when the declared position changes.
    filter = { internProfile: profile._id, position: { $ne: null } };
    update.position = positionId;
  }

  const flag = await ReadinessFlag.findOneAndUpdate(filter, update, {
    upsert: true,
    returnDocument: 'after',
  })
    .populate('technology', 'name slug')
    .populate('position', 'name slug')
    .populate('setBy', 'fullname');

  const plain = flag.toObject();
  return { ...plain, id: plain._id };
};

const listMyReadinessFlags = async (user) => {
  const profile = await InternProfile.findOne({ user: user._id });
  if (!profile) {
    const err = new Error('Intern profile not found');
    err.statusCode = 404;
    throw err;
  }

  const flags = await ReadinessFlag.find({ internProfile: profile._id })
    .populate('technology', 'name slug')
    .populate('position', 'name slug')
    .populate('setBy', 'fullname')
    .sort({ 'technology.name': 1 });

  return flags.map((flag) => {
    const plain = flag.toObject();
    return { ...plain, id: plain._id };
  });
};

module.exports = {
  listReadinessFlags,
  listMyReadinessFlags,
  upsertReadinessFlag,
  READINESS_LEVELS,
};
