const Sprint = require('../models/Sprint');
const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const { httpError } = require('../helpers/httpError');
const statusService = require('./statusService');
const ticketService = require('./ticketService');
const {
  deriveSprintState,
  sprintPermissions,
  sprintMetrics,
  pickSprintToShow,
  validateSprintDates,
  findOverlappingSprint,
  assertSprintEditable,
  assertSprintDeletable,
  SprintOverlapError,
} = require('../helpers/sprintRules');

// The derived view: state plus what may be done to the sprint, so the screen
// renders the actions it is allowed rather than re-deriving the rule from the
// dates.
const toSprintView = (sprint, today) => ({
  ...sprint.toObject(),
  state: deriveSprintState(sprint, today),
  permissions: sprintPermissions(sprint, today),
});

// Everything a read response needs beyond the stored fields: progress in story
// points, working days remaining and the needs-attention count, all computed by
// the pure rules helper so the frontend renders rather than computes.
//
// Archived tickets are fetched rather than filtered out in the query on
// purpose — excluding them is a sprint RULE, and the helper is where it lives,
// once. Both queries are workspace-scoped, and the sprint ids they read were
// themselves resolved within the workspace.
const withSprintMetrics = async (views, workspaceId, today) => {
  if (!views.length) return views;

  const sprintIds = views.map((view) => view._id);
  const [statuses, tickets] = await Promise.all([
    TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean(),
    Ticket.find({ workspace: workspaceId, sprint: { $in: sprintIds } })
      .select('sprint status storyPoints dueDate blockedBy isArchived')
      .lean(),
  ]);

  return views.map((view) => ({
    ...view,
    ...sprintMetrics(
      view,
      {
        tickets: tickets.filter((ticket) => String(ticket.sprint) === String(view._id)),
        statuses,
      },
      today
    ),
  }));
};

// A workspace's whole leftover set in one read — the modal's list scrolls
// rather than paginates, and no sprint holds anything near this many tickets.
const LEFTOVER_TICKET_LIMIT = 500;

const nextSprintName = async (workspaceId) => {
  const count = await Sprint.countDocuments({ workspace: workspaceId });
  return `Sprint ${count + 1}`;
};

const listSprints = async (workspaceId, today = new Date()) => {
  const sprints = await Sprint.find({ workspace: workspaceId }).sort({ start: 1 });
  return withSprintMetrics(
    sprints.map((sprint) => toSprintView(sprint, today)),
    workspaceId,
    today
  );
};

// The sprint a Sprints screen should render: the active one, else the next
// upcoming one, else null.
const getSprintToShow = async (workspaceId, today = new Date()) => {
  const sprints = await Sprint.find({ workspace: workspaceId }).sort({ start: 1 });
  const picked = pickSprintToShow(sprints, today);
  if (!picked) return null;

  const [view] = await withSprintMetrics([toSprintView(picked, today)], workspaceId, today);
  return view;
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
  const [view] = await withSprintMetrics([toSprintView(sprint, today)], workspaceId, today);
  return view;
};

// Re-run on every edit as well as on create — a corrected date range can collide
// just as easily as a new one. `sprintId` is the sprint being edited, so it is
// not reported as overlapping itself.
const assertNoOverlap = async ({ workspaceId, sprintId = null, start, end }) => {
  const existingSprints = await Sprint.find({ workspace: workspaceId });
  const collision = findOverlappingSprint({ _id: sprintId, start, end }, existingSprints);

  if (collision) {
    throw new SprintOverlapError(`This overlaps ${collision.name}.`, collision);
  }
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

  await assertNoOverlap({ workspaceId, start: startDate, end: endDate });

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

// How many tickets the sprint holds right now. Archived tickets keep their
// sprint reference but are excluded from every sprint number, so they are
// excluded here too — the count is what a person would see on the board.
const countSprintTickets = async (sprintId, workspaceId) =>
  Ticket.countDocuments({ workspace: workspaceId, sprint: sprintId, isArchived: { $ne: true } });

// Name, dates and goal are all correctable while the sprint is not yet past —
// including an active sprint's start date, which is the only way out of a sprint
// created with today's date by mistake (move it into the future, then delete it).
//
// Only the fields the caller sent are touched: a modal that saves the form
// without changing the goal must not be able to blank it by omission.
const updateSprint = async (
  { sprintId, workspaceId, name, start, end, goal },
  today = new Date()
) => {
  const sprint = await assertSprintInWorkspace(sprintId, workspaceId);
  assertSprintEditable(sprint, today);

  const startDate = start === undefined ? sprint.start : new Date(start);
  const endDate = end === undefined ? sprint.end : new Date(end);

  // `isNew: false` — an existing sprint that has already begun necessarily
  // started in the past, so the no-backdating rule cannot apply to it.
  validateSprintDates({ start: startDate, end: endDate }, today, { isNew: false });
  await assertNoOverlap({ workspaceId, sprintId: sprint._id, start: startDate, end: endDate });

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw httpError('A sprint needs a name.', 400);
    }
    sprint.name = trimmed;
  }
  if (goal !== undefined) sprint.goal = goal?.trim() || '';
  sprint.start = startDate;
  sprint.end = endDate;

  await sprint.save();

  return toSprintView(sprint, today);
};

// Deleting a sprint deletes the plan, never the work: every ticket in it has its
// sprint reference cleared and its status left exactly where it reached. That
// detach is a single `updateMany` rather than a pass through `updateTicket`,
// because there is no status transition to run and no sprint left to name in a
// history line — the frontend invalidates its ticket caches off the response.
//
// Archived tickets are detached too. They are excluded from the count the
// confirmation quotes, but leaving them pointing at a deleted sprint would
// resurrect a dangling reference the moment one was unarchived.
const deleteSprint = async ({ sprintId, workspaceId }, today = new Date()) => {
  const sprint = await assertSprintInWorkspace(sprintId, workspaceId);
  assertSprintDeletable(sprint, today);

  const ticketCount = await countSprintTickets(sprint._id, workspaceId);

  await Ticket.updateMany(
    { workspace: workspaceId, sprint: sprint._id },
    { $set: { sprint: null } }
  );
  await sprint.deleteOne();

  return { id: sprint._id, name: sprint.name, ticketsDetached: ticketCount };
};

// The sprint the one being planned follows: the most recent sprint that has
// already begun — the running one if there is one, else the last one that ended.
// An upcoming sprint is never "previous", since nothing has been worked in it.
const findPreviousSprint = async (workspaceId, today) => {
  const [previous] = await Sprint.find({ workspace: workspaceId, start: { $lte: today } })
    .sort({ start: -1 })
    .limit(1);
  return previous || null;
};

// What the create modal's third source tab offers: the previous sprint's
// unfinished tickets, so leftovers are not silently dropped between sprints.
// Nothing is carried across here — this is a read. A human drags a card, and the
// existing membership write moves the ticket, which is what takes it out of the
// old sprint (membership is a single reference on the ticket).
//
// "Unfinished" is a status not flagged done, and archived tickets are excluded,
// matching every other sprint number. Both reads are workspace-scoped.
const getPreviousSprintLeftovers = async (workspaceId, today = new Date()) => {
  if (!workspaceId) {
    throw httpError('No workspace associated with this account.', 400);
  }

  const previous = await findPreviousSprint(workspaceId, today);
  if (!previous) {
    return { sprint: null, tickets: [] };
  }

  const [{ doneIds }, page] = await Promise.all([
    statusService.getStatusIdSets(workspaceId),
    // Through the ticket list so the cards arrive in exactly the shape the
    // planning picker already renders, populations and all.
    ticketService.getAllTickets({
      workspaceId,
      sprintId: previous._id.toString(),
      archived: false,
      limit: LEFTOVER_TICKET_LIMIT,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    }),
  ]);

  const doneKeys = new Set(doneIds.map(String));
  const tickets = (page.tickets || []).filter((ticket) => {
    const statusId = ticket.status?._id ?? ticket.status;
    return !statusId || !doneKeys.has(String(statusId));
  });

  const [view] = await withSprintMetrics([toSprintView(previous, today)], workspaceId, today);

  return { sprint: view, tickets };
};

module.exports = {
  nextSprintName,
  listSprints,
  getPreviousSprintLeftovers,
  getSprintToShow,
  getSprint,
  createSprint,
  updateSprint,
  deleteSprint,
  countSprintTickets,
  assertSprintInWorkspace,
};
