const Sprint = require('../models/Sprint');
const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const Workspace = require('../models/Workspace');
const { httpError } = require('../helpers/httpError');
const statusService = require('./statusService');
const ticketService = require('./ticketService');
const {
  deriveSprintState,
  sprintPermissions,
  resolveSprintMetrics,
  pickSprintToShow,
  validateSprintDates,
  findOverlappingSprint,
  assertSprintEditable,
  assertSprintDeletable,
  SprintOverlapError,
  DEFAULT_SPRINT_DAYS,
  latestEndingSprint,
  defaultSprintWindow,
  resolveSprintWindow,
  resolveRollover,
  partitionSprintCarry,
} = require('../helpers/sprintRules');
const { emitSprintChanged } = require('../socket/events');

const toPlainSprint = (sprint) =>
  typeof sprint?.toObject === 'function' ? sprint.toObject() : sprint;

// The derived view: state plus what may be done to the sprint, so the screen
// renders the actions it is allowed rather than re-deriving the rule from the
// dates.
//
// `snapshot` never leaves the server. Its contents are already the response's
// `progress` / `workingDays` / `needsAttention` for a sealed sprint, so shipping
// it too would put the same numbers on the wire twice and invite a client to
// pick the wrong copy. `sealedAt` is kept, because "these numbers are final" is
// something the screen may legitimately want to say.
const toSprintView = (sprint, today) => {
  const { snapshot, ...stored } = toPlainSprint(sprint);

  return {
    ...stored,
    state: deriveSprintState(sprint, today),
    permissions: sprintPermissions(sprint, today),
    sealedAt: snapshot?.sealedAt ?? null,
  };
};

// Write-once, and workspace-scoped like every other sprint operation. The
// `snapshot: null` filter is what makes it write-once rather than merely
// idempotent: two concurrent reads of the same freshly-finished sprint both
// compute a seal, and only the first one lands. A sealed sprint is never
// touched again, so retrying a read that failed mid-write is harmless.
const sealSprints = async (seals, workspaceId) => {
  if (!seals.length) return;

  await Promise.all(
    seals.map(({ sprintId, seal }) =>
      Sprint.updateOne(
        { _id: sprintId, workspace: workspaceId, snapshot: null },
        { $set: { snapshot: seal } }
      )
    )
  );
};

// The read path for sprints: turns sprint documents into the views the API
// returns, and seals any of them that turn out to be past and unsealed.
//
// Everything a read response needs beyond the stored fields — progress in story
// points, working days remaining and the needs-attention count — is decided by
// the pure rules helper, so the frontend renders rather than computes and a past
// sprint's numbers come off its seal rather than off tickets that may since have
// left it (ADR 0012).
//
// The seal is awaited before the views are returned. That ordering is the whole
// point of ADR 0012: the leftovers read must have finished sealing the previous
// sprint before it offers anything to carry out of it, or the membership write
// that follows rewrites the record.
//
// Archived tickets are fetched rather than filtered out in the query on
// purpose — excluding them is a sprint RULE, and the helper is where it lives,
// once. Both queries are workspace-scoped, and the sprint ids they read were
// themselves resolved within the workspace.
const withSprintMetrics = async (sprints, workspaceId, today) => {
  if (!sprints.length) return [];

  const sprintIds = sprints.map((sprint) => sprint._id);
  const [statuses, tickets] = await Promise.all([
    TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean(),
    Ticket.find({ workspace: workspaceId, sprint: { $in: sprintIds } })
      .select('sprint status storyPoints dueDate blockedBy isArchived')
      .lean(),
  ]);

  const seals = [];
  const views = sprints.map((sprint) => {
    const plain = toPlainSprint(sprint);
    const { metrics, seal } = resolveSprintMetrics(
      plain,
      {
        tickets: tickets.filter((ticket) => String(ticket.sprint) === String(plain._id)),
        statuses,
      },
      today
    );

    if (seal) seals.push({ sprintId: plain._id, seal });

    return { ...toSprintView({ ...plain, snapshot: seal ?? plain.snapshot }, today), ...metrics };
  });

  await sealSprints(seals, workspaceId);

  return views;
};

// A workspace's whole leftover set in one read — the modal's list scrolls
// rather than paginates, and no sprint holds anything near this many tickets.
const LEFTOVER_TICKET_LIMIT = 500;

const nextSprintName = async (workspaceId) => {
  const count = await Sprint.countDocuments({ workspace: workspaceId });
  return `Sprint ${count + 1}`;
};

// How this workspace runs sprints, with the shipped cadence standing in for a
// workspace saved before the field existed. Read through one function so the
// two defaults are stated once.
const getWorkspaceSprintSettings = async (workspaceId) => {
  const workspace = await Workspace.findById(workspaceId).select('sprintSettings').lean();

  return {
    autoRollover: workspace?.sprintSettings?.autoRollover ?? true,
    lengthDays: workspace?.sprintSettings?.lengthDays ?? DEFAULT_SPRINT_DAYS,
  };
};

// The sprint a new one must be planned after — the one ending LATEST, upcoming
// sprints included. See `latestEndingSprint`'s comment for why this is not
// `findPreviousSprint`: that one skips upcoming sprints, and defaulting off the
// active sprint while a planned one exists produces a window that collides.
//
// Sorted in Mongo rather than in `latestEndingSprint` so the index does the work
// and only one document comes back.
const findLatestEndingSprint = async (workspaceId) => {
  const [latest] = await Sprint.find({ workspace: workspaceId }).sort({ end: -1 }).limit(1);
  return latest || null;
};

// What the create modal prefills its form with: the name and window a sprint
// would get if nobody touched anything.
//
// It comes off the server rather than being derived in the frontend because the
// window is a RULE — shared with the rollover — not display data, and because a
// modal that shows empty pickers and then saves dates the person never saw is
// worse than having no default at all.
const getNextSprintWindow = async (workspaceId, today = new Date()) => {
  if (!workspaceId) {
    throw httpError('No workspace associated with this account.', 400);
  }

  const [latest, settings, name] = await Promise.all([
    findLatestEndingSprint(workspaceId),
    getWorkspaceSprintSettings(workspaceId),
    nextSprintName(workspaceId),
  ]);

  const { start, end } = defaultSprintWindow(latest, today, settings.lengthDays);

  return { name, start, end, lengthDays: settings.lengthDays };
};

const listSprints = async (workspaceId, today = new Date()) => {
  await rolloverIfDue(workspaceId, today);
  const sprints = await Sprint.find({ workspace: workspaceId }).sort({ start: 1 });
  return withSprintMetrics(sprints, workspaceId, today);
};

// The sprint a Sprints screen should render: the active one, else the next
// upcoming one, else null.
//
// Every sprint in the workspace goes through `withSprintMetrics`, not only the
// one that is picked. Deciding which sprint to show means deriving the state of
// all of them, and ADR 0012 puts the seal on exactly that: a read that finds a
// sprint to be past and unsealed seals it, whether or not that sprint is the one
// being returned.
const getSprintToShow = async (workspaceId, today = new Date()) => {
  await rolloverIfDue(workspaceId, today);
  const sprints = await Sprint.find({ workspace: workspaceId }).sort({ start: 1 });
  const views = await withSprintMetrics(sprints, workspaceId, today);

  const picked = pickSprintToShow(sprints, today);
  if (!picked) return null;

  return views.find((view) => String(view._id) === String(picked._id)) ?? null;
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
  const [view] = await withSprintMetrics([sprint], workspaceId, today);
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

// Prefills whatever the caller left out — the name from the next number in
// sequence, and the DATES from the workspace's cadence — then validates and
// rejects any overlap with an existing sprint before creating it.
//
// Both dates are optional, and so is either one alone: `resolveSprintWindow`
// owns that. The filled window then goes through exactly the same
// `validateSprintDates` and `assertNoOverlap` as a typed one, which is what
// stops a default reaching the database by skipping a rule — and is why the
// no-backdating rule is what pushes a stale cadence forward to today rather
// than something this function has to know about.
const createSprint = async ({ workspaceId, name, start, end, goal }, today = new Date()) => {
  if (!workspaceId) {
    throw httpError('No workspace associated with this account.', 400);
  }

  const [latest, settings] = await Promise.all([
    findLatestEndingSprint(workspaceId),
    getWorkspaceSprintSettings(workspaceId),
  ]);

  const { start: startDate, end: endDate } = resolveSprintWindow(
    { start, end },
    latest,
    today,
    settings.lengthDays
  );

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

  emitSprintChanged(workspaceId);

  return toSprintView(sprint, today);
};

// ---------------------------------------------------------------------------
// Rollover. A finished sprint with nothing after it grows its own successor,
// and the work that did not get done follows it across. See ADR 0014.
// ---------------------------------------------------------------------------

// Called at the top of every sprint read, and does nothing on almost all of
// them — `resolveRollover` returns null unless every sprint in the workspace is
// past and the most recent one ended recently. Returns null when it did
// nothing, so a caller can tell.
//
// THE ORDER OF THE THREE WRITES IS THE WHOLE THING, and it is ADR 0012's order:
//
//   1. SEAL the ending sprint, before a single ticket can move.
//   2. CREATE the successor.
//   3. CARRY the unfinished tickets into it.
//
// Steps 1 and 3 the other way round and the rollover rewrites the history of the
// sprint it is closing: membership is one reference on the ticket, so carrying a
// leftover out of a finished sprint shrinks its total and RAISES its
// done-percentage — the sprint that missed the work ends up looking as though it
// never had it. ADR 0012 records that as observed, not theorised.
//
// Concurrency is the unique partial index on `{ workspace, rolledOverFrom }`
// (see `models/Sprint.js`), not anything in this function. Two reads racing here
// both get as far as the insert; one lands, the other takes an E11000 and bails,
// and its caller re-reads and sees the sprint the winner made.
//
// Every query is workspace-scoped, including the ticket carry.
const rolloverIfDue = async (workspaceId, today = new Date()) => {
  if (!workspaceId) return null;

  const [sprints, settings] = await Promise.all([
    Sprint.find({ workspace: workspaceId }).sort({ start: 1 }),
    getWorkspaceSprintSettings(workspaceId),
  ]);

  const due = resolveRollover(sprints, today, settings);
  if (!due) return null;

  const { endedSprint, window } = due;

  // 1. Seal first. `withSprintMetrics` is what writes the snapshot, and it has
  //    to have finished before step 3 changes any membership.
  await withSprintMetrics([endedSprint], workspaceId, today);

  // 2. The successor goes through the same rules a hand-made sprint does. This
  //    one is a genuine invariant and never fires: the window comes from the
  //    same helper the create path uses. It stays an assert because a rollover
  //    that silently wrote a sprint the API would have refused is worse than one
  //    that throws.
  validateSprintDates(window, today, { isNew: true });

  let created;
  try {
    // The overlap check and the insert are ONE unit, because both of their
    // failures mean the same thing: another request rolled this sprint over
    // while we were deciding to. Neither is an error to report — the caller
    // re-reads and finds the winner's sprint.
    //
    // This is the whole reason they are inside the try. `rolloverIfDue` runs on
    // a GET, and a read that answers 409 because it raced another read is a
    // broken page. Nothing else can make either of them fire: `resolveRollover`
    // returns a window only when EVERY sprint in the workspace is already past,
    // so the window starts today and cannot collide with anything that was there
    // when we looked. If it collides now, the set changed underneath us.
    await assertNoOverlap({ workspaceId, start: window.start, end: window.end });

    created = await Sprint.create({
      workspace: workspaceId,
      name: await nextSprintName(workspaceId),
      start: window.start,
      end: window.end,
      goal: '',
      rolledOverFrom: endedSprint._id,
    });
  } catch (error) {
    if (error?.code === 11000 || error?.name === 'SprintOverlapError') return null;
    throw error;
  }

  // 3. Carry, as ONE `updateMany` rather than a pass through `updateTicket`.
  //    The usual rule in this codebase is the opposite, because `updateTicket`
  //    owns status transitions, time-in-status, history lines and socket events.
  //    None of those apply here: a carried ticket KEEPS its status, so there is
  //    no transition to run. `deleteSprint` below detaches for exactly the same
  //    reason and in exactly the same way — and one bulk write is also what
  //    keeps this off the critical path of a GET.
  const [statuses, tickets] = await Promise.all([
    TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean(),
    Ticket.find({ workspace: workspaceId, sprint: endedSprint._id })
      .select('status isArchived')
      .lean(),
  ]);

  const { carry } = partitionSprintCarry(tickets, statuses);

  if (carry.length > 0) {
    await Ticket.updateMany(
      { workspace: workspaceId, sprint: endedSprint._id, _id: { $in: carry } },
      { $set: { sprint: created._id } }
    );
  }

  // A sprint appearing and tickets moving is the largest change the board can
  // undergo with nobody having clicked anything, so both cache scopes go.
  emitSprintChanged(workspaceId, { detachedTickets: carry.length > 0 });

  return { sprint: created, carriedTicketCount: carry.length, sealedSprintId: endedSprint._id };
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

  emitSprintChanged(sprint.workspace);

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

  // The detach moved tickets out of the sprint, so every other client's ticket
  // caches are stale too — the deleting client invalidates its own off the
  // response.
  emitSprintChanged(sprint.workspace, { detachedTickets: true });

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

  // Before `findPreviousSprint`, so this read sees the world the rollover left
  // rather than the one it found — otherwise the modal would offer leftovers out
  // of a sprint the same request is about to move them out of.
  await rolloverIfDue(workspaceId, today);

  const previous = await findPreviousSprint(workspaceId, today);
  if (!previous) {
    return { sprint: null, tickets: [] };
  }

  // SEAL FIRST, before a single leftover is offered. This is the ordering ADR
  // 0012 exists for: carrying a leftover forward is the one routine way a
  // finished sprint's membership changes, and the membership write is sent by
  // the client that just read this response. Sealing here means the record is
  // already written down by the time anything can move, so the sprint that
  // failed to deliver the ticket goes on saying so. Move this below the ticket
  // read and it still works by luck; move it out of the request and it does not.
  const [view] = await withSprintMetrics([previous], workspaceId, today);

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

  return { sprint: view, tickets };
};

module.exports = {
  nextSprintName,
  getNextSprintWindow,
  getWorkspaceSprintSettings,
  findLatestEndingSprint,
  rolloverIfDue,
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
