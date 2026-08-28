const Sprint = require('../models/Sprint');
const { httpError } = require('../helpers/httpError');
const {
  deriveSprintState,
  pickSprintToShow,
  validateSprintDates,
  findOverlappingSprint,
  SprintOverlapError,
} = require('../helpers/sprintRules');

// This ticket stores nothing beyond workspace/name/start/end/goal, so the
// derived view is just the state — later tickets add progress, working days
// and needs-attention here.
const toSprintView = (sprint, today) => ({
  ...sprint.toObject(),
  state: deriveSprintState(sprint, today),
});

const nextSprintName = async (workspaceId) => {
  const count = await Sprint.countDocuments({ workspace: workspaceId });
  return `Sprint ${count + 1}`;
};

const listSprints = async (workspaceId, today = new Date()) => {
  const sprints = await Sprint.find({ workspace: workspaceId }).sort({ start: 1 });
  return sprints.map((sprint) => toSprintView(sprint, today));
};

// The sprint a Sprints screen should render: the active one, else the next
// upcoming one, else null.
const getSprintToShow = async (workspaceId, today = new Date()) => {
  const sprints = await Sprint.find({ workspace: workspaceId }).sort({ start: 1 });
  const picked = pickSprintToShow(sprints, today);
  return picked ? toSprintView(picked, today) : null;
};

const assertSprintInWorkspace = async (sprintId, workspaceId) => {
  if (!workspaceId) {
    throw httpError('No workspace associated with this account.', 400);
  }
  const sprint = await Sprint.findById(sprintId);
  if (!sprint) {
    throw httpError('Sprint not found.', 404);
  }
  if (sprint.workspace.toString() !== workspaceId.toString()) {
    throw httpError('This sprint does not belong to the selected workspace.', 404);
  }
  return sprint;
};

const getSprint = async (sprintId, workspaceId, today = new Date()) => {
  const sprint = await assertSprintInWorkspace(sprintId, workspaceId);
  return toSprintView(sprint, today);
};

// Prefills the name with the next number in sequence when the caller doesn't
// name the sprint explicitly, then validates dates and rejects any overlap
// with an existing sprint in the workspace before creating it.
const createSprint = async ({ workspaceId, name, start, end, goal }, today = new Date()) => {
  if (!workspaceId) {
    throw httpError('No workspace associated with this account.', 400);
  }
  if (!start || !end) {
    throw httpError('A sprint needs a start and an end date.', 400);
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  validateSprintDates({ start: startDate, end: endDate }, today, { isNew: true });

  const existingSprints = await Sprint.find({ workspace: workspaceId });
  const collision = findOverlappingSprint({ start: startDate, end: endDate }, existingSprints);
  if (collision) {
    throw new SprintOverlapError(`This overlaps ${collision.name}.`, collision);
  }

  const resolvedName = name?.trim() || (await nextSprintName(workspaceId));

  const sprint = await Sprint.create({
    workspace: workspaceId,
    name: resolvedName,
    start: startDate,
    end: endDate,
    goal: goal?.trim() || '',
  });

  return toSprintView(sprint, today);
};

module.exports = {
  nextSprintName,
  listSprints,
  getSprintToShow,
  getSprint,
  createSprint,
  assertSprintInWorkspace,
};
