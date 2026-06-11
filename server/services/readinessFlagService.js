const Technology = require('../models/Technology');
const ReadinessFlag = require('../models/ReadinessFlag');
const { READINESS_LEVELS } = require('../models/ReadinessFlag');
const { ROLES } = require('../constants/roles');
const { assertInternAccess, canWriteMentorData } = require('../helpers/internAccess');

const listReadinessFlags = async (user, internUserId) => {
  const profile = await assertInternAccess(user, internUserId);

  if (user.role === ROLES.INTERN) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const flags = await ReadinessFlag.find({ internProfile: profile._id })
    .populate('technology', 'name slug')
    .populate('setBy', 'fullname')
    .sort({ 'technology.name': 1 });

  return flags.map((flag) => {
    const plain = flag.toObject();
    return { ...plain, id: plain._id };
  });
};

const upsertReadinessFlag = async (user, internUserId, { technologyId, level }) => {
  const profile = await assertInternAccess(user, internUserId, { write: true });

  if (!canWriteMentorData(user, profile)) {
    const err = new Error('Not authorized to set readiness');
    err.statusCode = 403;
    throw err;
  }

  if (!technologyId) throw new Error('Technology is required');
  if (!READINESS_LEVELS.includes(level)) throw new Error('Invalid readiness level');

  const technology = await Technology.findOne({ _id: technologyId, isActive: true });
  if (!technology) throw new Error('Invalid technology');

  const flag = await ReadinessFlag.findOneAndUpdate(
    { internProfile: profile._id, technology: technologyId },
    { level, setBy: user._id },
    { upsert: true, new: true }
  )
    .populate('technology', 'name slug')
    .populate('setBy', 'fullname');

  const plain = flag.toObject();
  return { ...plain, id: plain._id };
};

module.exports = { listReadinessFlags, upsertReadinessFlag, READINESS_LEVELS };
