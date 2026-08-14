const internDashboardService = require('../services/internDashboardService');
const internProgressService = require('../services/internProgressService');
const standupSummaryService = require('../services/standupSummaryService');

const handleError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  next(error);
};

exports.getInternDashboard = async (req, res, next) => {
  try {
    // The subject is always `req.user` — there is no id or workspace parameter to
    // pass through, by design. See services/internDashboardService.js.
    const data = await internDashboardService.getInternDashboard(req.user);
    res.json({ success: true, message: 'Intern dashboard retrieved', data });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getInternProgress = async (req, res, next) => {
  try {
    // Same rule as the board above: the subject is always `req.user`, and this
    // payload carries the caller's own evaluations (notes included), readiness and
    // recommendations — so there is no id parameter to accept.
    const data = await internProgressService.getInternProgress(req.user);
    res.json({ success: true, message: 'Intern progress retrieved', data });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.summarizeMyStandup = async (req, res, next) => {
  try {
    // Same rule as the board itself: the subject is `req.user`, never a parameter.
    const data = await standupSummaryService.summarizeOwnStandup(req.user);
    res.json({ success: true, message: 'Standup summarised', data });
  } catch (error) {
    handleError(res, error, next);
  }
};
