const sprintService = require('../services/sprintService');
const sprintSummaryService = require('../services/sprintSummaryService');
const { handleControllerError } = require('../helpers/controllerError');
const { httpError } = require('../helpers/httpError');
const { resolveActiveWorkspaceId } = require('../helpers/workspaceAuthz');

const resolveWorkspaceId = async (req) => {
  const workspaceId = await resolveActiveWorkspaceId({
    user: req.user,
    override: req.query?.workspace || req.body?.workspace,
  });

  if (!workspaceId) {
    throw httpError('No workspace associated with this account.', 400);
  }

  return workspaceId;
};

const getSprints = async (req, res, next) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const sprints = await sprintService.listSprints(workspaceId);
    res.status(200).json({ success: true, message: 'Sprints fetched', data: sprints });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

// The sprint a Sprints screen should show: the active one, else the next
// upcoming one, else null.
const getSprintToShow = async (req, res, next) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const sprint = await sprintService.getSprintToShow(workspaceId);
    res.status(200).json({ success: true, message: 'Sprint fetched', data: sprint });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

// The previous sprint's unfinished tickets, offered by the create modal's third
// source tab. `data.sprint` is null when there is no previous sprint, which is
// how the modal knows to leave the tab out rather than show an empty one.
const getPreviousSprintLeftovers = async (req, res, next) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const leftovers = await sprintService.getPreviousSprintLeftovers(workspaceId);
    res.status(200).json({ success: true, message: 'Sprint leftovers fetched', data: leftovers });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

const getSprintById = async (req, res, next) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const sprint = await sprintService.getSprint(req.params.id, workspaceId);
    res.status(200).json({ success: true, message: 'Sprint fetched', data: sprint });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

const createSprint = async (req, res, next) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const { name, start, end, goal } = req.body;
    const sprint = await sprintService.createSprint({ workspaceId, name, start, end, goal });
    res.status(201).json({ success: true, message: 'Sprint created', data: sprint });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

// The same modal that creates a sprint edits one, so this takes the same body.
// Only the keys actually present are forwarded — an absent key leaves the stored
// value alone rather than blanking it.
const updateSprint = async (req, res, next) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const { name, start, end, goal } = req.body;
    const sprint = await sprintService.updateSprint({
      sprintId: req.params.id,
      workspaceId,
      name,
      start,
      end,
      goal,
    });
    res.status(200).json({ success: true, message: 'Sprint updated', data: sprint });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

const deleteSprint = async (req, res, next) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const result = await sprintService.deleteSprint({ sprintId: req.params.id, workspaceId });
    res.status(200).json({ success: true, message: 'Sprint deleted', data: result });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

// The cached AI recap for one sprint. `data.hasSummary` is false when nothing has
// been generated yet — the numbers (`data.team.points`, `data.perUser`) are still
// there, since those are computed from the tickets, not from the model.
const getSprintSummary = async (req, res, next) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const data = await sprintSummaryService.getSprintSummary({
      sprintId: req.params.id,
      workspaceId,
    });
    res.status(200).json({ success: true, message: 'Sprint summary fetched', data });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

// Generate or regenerate the recap. One Groq call; an AI failure carries a
// statusCode and is answered as-is, with nothing persisted.
const generateSprintSummary = async (req, res, next) => {
  try {
    const workspaceId = await resolveWorkspaceId(req);
    const data = await sprintSummaryService.generateSprintSummary({
      sprintId: req.params.id,
      workspaceId,
      requesterId: req.user._id,
    });
    res.status(201).json({ success: true, message: 'Sprint summary generated', data });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

module.exports = {
  getSprints,
  getSprintToShow,
  getPreviousSprintLeftovers,
  getSprintById,
  createSprint,
  updateSprint,
  deleteSprint,
  getSprintSummary,
  generateSprintSummary,
};
