const sprintService = require('../services/sprintService');
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

module.exports = { getSprints, getSprintToShow, getSprintById, createSprint };
