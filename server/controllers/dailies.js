const dailyService = require('../services/dailyService');

const resolveWorkspaceId = (req) => {
  const isAdmin = req.user?.role === 'admin';
  const queryWorkspaceId = req.query?.workspace || req.body?.workspace;
  return isAdmin && queryWorkspaceId ? queryWorkspaceId : req.user?.workspaceId;
};

const handleDailyError = (error, res, next) => {
  if (error.name === 'DailyValidationError' || Number.isInteger(error.statusCode)) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
  next(error);
};

const getDaily = async (req, res, next) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const { date } = req.query;

    const { daily, counts, activeInterns, isEditable } = await dailyService.getDaily({
      workspaceId,
      date,
      user: req.user,
    });

    res.status(200).json({
      success: true,
      data: daily ? { ...daily.toObject(), counts, activeInterns, isEditable } : null,
    });
  } catch (error) {
    handleDailyError(error, res, next);
  }
};

const getDailyHistory = async (req, res, next) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const history = await dailyService.getDailyHistory({ workspaceId, user: req.user });

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    handleDailyError(error, res, next);
  }
};

const startDaily = async (req, res, next) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const { date } = req.body;

    const daily = await dailyService.startDaily({ workspaceId, date, user: req.user });

    res.status(200).json({ success: true, message: 'Daily started', data: daily });
  } catch (error) {
    handleDailyError(error, res, next);
  }
};

const addEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { member, done, todo, blockers } = req.body;

    const daily = await dailyService.addEntry({
      dailyId: id,
      memberId: member,
      done,
      todo,
      blockers,
      user: req.user,
    });

    res.status(201).json({ success: true, message: 'Entry added', data: daily });
  } catch (error) {
    handleDailyError(error, res, next);
  }
};

const updateEntry = async (req, res, next) => {
  try {
    const { id, entryId } = req.params;
    const { done, todo, blockers } = req.body;

    const daily = await dailyService.updateEntry({
      dailyId: id,
      entryId,
      done,
      todo,
      blockers,
      user: req.user,
    });

    res.status(200).json({ success: true, message: 'Entry updated', data: daily });
  } catch (error) {
    handleDailyError(error, res, next);
  }
};

const removeEntry = async (req, res, next) => {
  try {
    const { id, entryId } = req.params;

    const daily = await dailyService.removeEntry({ dailyId: id, entryId, user: req.user });

    res.status(200).json({ success: true, message: 'Entry removed', data: daily });
  } catch (error) {
    handleDailyError(error, res, next);
  }
};

module.exports = {
  getDaily,
  getDailyHistory,
  startDaily,
  addEntry,
  updateEntry,
  removeEntry,
};
