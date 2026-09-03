// Pure, clock-free rules for Sprints. `today` is always injected, never read
// from the system clock, so every date test is deterministic and none needs
// fake timers. See ADR 0010 — a sprint stores only its dates; state, overlap
// and validation are all derived here rather than stored.

const { isBlockedStatusSlug } = require('./ticketBlocker');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MIN_SPRINT_DAYS = 7; // one week
const MAX_SPRINT_DAYS = 56; // eight weeks

// The cadence a sprint gets when nobody picks dates. Two weeks, INCLUSIVE of
// both endpoints — `validateSprintDates` measures length the same way — so the
// window is `start + 13 days`, not `start + 14`. A workspace may override it
// (`Workspace.sprintSettings.lengthDays`), which is why every helper below takes
// the length as an argument rather than reading this constant directly.
const DEFAULT_SPRINT_DAYS = 14; // two weeks

class SprintValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SprintValidationError';
    this.statusCode = 400;
  }
}

// A sprint collides with another workspace sprint. Carries the colliding
// sprint in `data` so the caller can name it without a second lookup.
class SprintOverlapError extends Error {
  constructor(message, collidingSprint) {
    super(message);
    this.name = 'SprintOverlapError';
    this.statusCode = 409;
    this.data = { collidingSprint };
  }
}

// The sprint's own state forbids the change — not the caller's role. 409 rather
// than 403 for exactly that reason: nobody may delete a running sprint, so this
// is a conflict with the resource's state and not an authorization failure.
class SprintNotMutableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SprintNotMutableError';
    this.statusCode = 409;
  }
}

// Calendar day at UTC midnight — sprint dates are plain calendar days with no
// time-of-day meaning, so this strips whatever time component reached us
// (including a `Date` built from a same-day-local-timezone input) rather than
// comparing instants.
const toUtcDay = (value) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const dayDiff = (a, b) => Math.round((toUtcDay(a).getTime() - toUtcDay(b).getTime()) / MS_PER_DAY);

// Calendar-day arithmetic, at UTC midnight like everything else here.
const addDays = (value, days) => new Date(toUtcDay(value).getTime() + days * MS_PER_DAY);

// A configured length is held inside the bounds `validateSprintDates` enforces,
// so a workspace setting of 3 days degrades to the minimum rather than making
// every create fail on a window the server itself chose.
const clampSprintLength = (lengthDays) => {
  const length = Number(lengthDays);
  if (!Number.isFinite(length)) return DEFAULT_SPRINT_DAYS;
  return Math.min(MAX_SPRINT_DAYS, Math.max(MIN_SPRINT_DAYS, Math.round(length)));
};

const SPRINT_STATES = Object.freeze({
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  PAST: 'past',
});

// Upcoming / active / past, read off the sprint's dates against `today`.
// Inclusive on both ends: a sprint is active on its start date and on its end
// date alike.
const deriveSprintState = ({ start, end }, today) => {
  const day = toUtcDay(today);
  const startDay = toUtcDay(start);
  const endDay = toUtcDay(end);

  if (day.getTime() < startDay.getTime()) return SPRINT_STATES.UPCOMING;
  if (day.getTime() > endDay.getTime()) return SPRINT_STATES.PAST;
  return SPRINT_STATES.ACTIVE;
};

// Which sprint a screen should show: the active one, else the soonest
// upcoming one, else none. `sprints` needs only `start`/`end` on each entry.
const pickSprintToShow = (sprints, today) => {
  const active = sprints.find(
    (sprint) => deriveSprintState(sprint, today) === SPRINT_STATES.ACTIVE
  );
  if (active) return active;

  const upcoming = sprints
    .filter((sprint) => deriveSprintState(sprint, today) === SPRINT_STATES.UPCOMING)
    .sort((a, b) => toUtcDay(a.start).getTime() - toUtcDay(b.start).getTime());

  return upcoming[0] || null;
};

// Throws SprintValidationError on the first rule broken; returns nothing on
// success. `today` gates the no-backdating rule, which only applies to a
// sprint being newly created — an existing active sprint necessarily started
// in the past and must not be re-validated against it.
const validateSprintDates = ({ start, end }, today, { isNew = true } = {}) => {
  const startDay = toUtcDay(start);
  const endDay = toUtcDay(end);

  if (endDay.getTime() < startDay.getTime()) {
    throw new SprintValidationError('A sprint must end on or after its start date.');
  }

  if (isNew && startDay.getTime() < toUtcDay(today).getTime()) {
    throw new SprintValidationError('A new sprint may not start in the past.');
  }

  const lengthDays = dayDiff(endDay, startDay) + 1;
  if (lengthDays < MIN_SPRINT_DAYS) {
    throw new SprintValidationError('A sprint must run for at least one week.');
  }
  if (lengthDays > MAX_SPRINT_DAYS) {
    throw new SprintValidationError('A sprint may not run for more than eight weeks.');
  }
};

// Containment and shared endpoints count as overlap, not merely a partial
// overlap — this is a plain inclusive interval intersection test.
const sprintsOverlap = (a, b) => {
  const aStart = toUtcDay(a.start).getTime();
  const aEnd = toUtcDay(a.end).getTime();
  const bStart = toUtcDay(b.start).getTime();
  const bEnd = toUtcDay(b.end).getTime();

  return aStart <= bEnd && bStart <= aEnd;
};

const sprintKey = (sprint) => {
  const id = sprint?._id ?? sprint?.id;
  return id ? String(id) : null;
};

// The first sprint among `existingSprints` that `candidate` overlaps, or null.
//
// A sprint never collides with itself: when `candidate` carries an id — which it
// does on an edit, and does not on a create — the sprint with that id is skipped.
// Without this, saving an edit that leaves the dates alone would report the
// sprint as overlapping itself.
const findOverlappingSprint = (candidate, existingSprints) => {
  const candidateKey = sprintKey(candidate);

  return (
    existingSprints.find(
      (sprint) =>
        !(candidateKey && sprintKey(sprint) === candidateKey) && sprintsOverlap(candidate, sprint)
    ) || null
  );
};

// ---------------------------------------------------------------------------
// Default dates. Picking dates is optional; leaving them out gives a sprint of
// the workspace's configured length that starts where the last one ends.
//
// One rule, used by the create path AND by the rollover, so the sprint a person
// asks for and the sprint that appears on its own can never be different shapes.
// ---------------------------------------------------------------------------

// The sprint a new one has to be planned AFTER: the one ending latest, whatever
// its state.
//
// Deliberately NOT `findPreviousSprint`, which skips upcoming sprints because
// "nothing has been worked in them" — right for offering leftovers, wrong here.
// Chaining a default off the ACTIVE sprint's end while an upcoming sprint
// already exists lands the new window straight on top of it, and the create
// then fails the overlap check against a date the server itself chose.
const latestEndingSprint = (sprints = []) =>
  sprints.reduce((latest, sprint) => {
    if (!sprint?.end) return latest;
    if (!latest) return sprint;
    return toUtcDay(sprint.end).getTime() > toUtcDay(latest.end).getTime() ? sprint : latest;
  }, null);

// The window a sprint gets when nobody picks one: the day after the last sprint
// ends, for `lengthDays` inclusive.
//
// Two rules are doing real work here.
//
// `+ 1` day, because `sprintsOverlap` is inclusive on both ends — a shared
// endpoint IS an overlap — so the day after is the earliest legal start and
// sprints run back to back with no gap.
//
// And `max(…, today)`: `validateSprintDates` refuses to backdate a NEW sprint,
// so if the last sprint ended in July and it is now September, the day after it
// is a date the create would reject. Today wins in that case, leaving the gap
// where it already is rather than planning a sprint that is half over.
const defaultSprintWindow = (latestSprint, today, lengthDays = DEFAULT_SPRINT_DAYS) => {
  const length = clampSprintLength(lengthDays);
  const floor = toUtcDay(today);
  const afterLatest = latestSprint?.end ? addDays(latestSprint.end, 1) : null;
  const start = afterLatest && afterLatest.getTime() > floor.getTime() ? afterLatest : floor;

  return { start, end: addDays(start, length - 1) };
};

const hasDate = (value) => value !== undefined && value !== null && value !== '';

// What the caller asked for, with whatever they left out filled in. Either date
// may be omitted, or both.
//
// A date that WAS given is passed through as `new Date(value)` untouched, so
// this changes nothing about how a typed date is stored; only defaults are
// normalised to UTC midnight.
//
// One date given fills the other from the same rule rather than from today:
// a start with no end runs the configured length from that start, and an end
// with no start begins where the default would. Anything the two of them make
// still goes through `validateSprintDates` and the overlap check, so a default
// can never reach the database by skipping a rule.
const resolveSprintWindow = (
  { start, end } = {},
  latestSprint,
  today,
  lengthDays = DEFAULT_SPRINT_DAYS
) => {
  const length = clampSprintLength(lengthDays);

  if (hasDate(start) && hasDate(end)) {
    return { start: new Date(start), end: new Date(end) };
  }

  if (hasDate(start)) {
    const startDate = new Date(start);
    return { start: startDate, end: addDays(startDate, length - 1) };
  }

  const fallback = defaultSprintWindow(latestSprint, today, length);

  if (hasDate(end)) {
    return { start: fallback.start, end: new Date(end) };
  }

  return fallback;
};

const SPRINT_NOT_EDITABLE = 'A past sprint is a record and can no longer be changed.';
const SPRINT_NOT_DELETABLE =
  'A sprint the team is already working in cannot be deleted. Move its start date into the future first.';

// Mutability follows straight from the state, so it can never disagree with the
// dates: upcoming is editable and deletable, active is editable but not
// deletable (deleting it would pull the board out from under everyone), past is
// neither — history is not rewritten.
//
// Editing an active sprint's START date is deliberately allowed. It is the only
// escape hatch for a sprint created with today's date by mistake: move the start
// into the future, which makes it upcoming, then delete it.
const canEditSprint = (sprint, today) => deriveSprintState(sprint, today) !== SPRINT_STATES.PAST;

const canDeleteSprint = (sprint, today) =>
  deriveSprintState(sprint, today) === SPRINT_STATES.UPCOMING;

// The pair the read responses carry, so the UI renders the actions it is allowed
// rather than re-deriving the rule from the dates.
const sprintPermissions = (sprint, today) => ({
  canEdit: canEditSprint(sprint, today),
  canDelete: canDeleteSprint(sprint, today),
});

// Throw on a refused change; return nothing when it is allowed.
const assertSprintEditable = (sprint, today) => {
  if (!canEditSprint(sprint, today)) {
    throw new SprintNotMutableError(SPRINT_NOT_EDITABLE);
  }
};

const assertSprintDeletable = (sprint, today) => {
  if (!canDeleteSprint(sprint, today)) {
    throw new SprintNotMutableError(
      canEditSprint(sprint, today) ? SPRINT_NOT_DELETABLE : SPRINT_NOT_EDITABLE
    );
  }
};

// Shown to whoever tried to add the ticket, so it says what to do about it.
const SPRINT_ESTIMATE_REQUIRED =
  'A ticket needs a story-point estimate before it can join a sprint.';

// A sprint measures progress in story points, so an unestimated ticket would be
// worth zero and hold its sprint below 100% forever. Estimates are therefore a
// condition of membership rather than a nicety. See ADR 0011.
const hasSprintEstimate = (ticket) =>
  typeof ticket?.storyPoints === 'number' && ticket.storyPoints > 0;

// Throws SprintValidationError when the ticket carries no estimate; returns
// nothing on success. Called wherever a ticket enters a sprint, not only from
// the planning modal.
const assertTicketMayJoinSprint = (ticket) => {
  if (!hasSprintEstimate(ticket)) {
    throw new SprintValidationError(SPRINT_ESTIMATE_REQUIRED);
  }
};

// ---------------------------------------------------------------------------
// Aggregations over a sprint's tickets — progress, days left, needs attention.
//
// Everything below takes plain data and returns plain data, so the read
// response can carry the numbers and the screen can render rather than
// compute. One implementation of each rule, tested here.
// ---------------------------------------------------------------------------

const isWeekend = (date) => {
  const weekday = toUtcDay(date).getUTCDay();
  return weekday === 0 || weekday === 6;
};

// Monday to Friday, inclusive of both ends, with no holiday calendar. The
// observance calendar elsewhere in the codebase covers religious observances
// and is deliberately not consulted here. Returns 0 when `end` precedes `start`.
const countWorkingDays = (start, end) => {
  const last = toUtcDay(end).getTime();
  let cursor = toUtcDay(start);
  let count = 0;

  while (cursor.getTime() <= last) {
    if (!isWeekend(cursor)) count += 1;
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }

  return count;
};

// Working days the sprint holds in total, and how many of them are left.
// Counting starts from today once the sprint has begun, and from its start date
// while it is still upcoming — an upcoming sprint has all of its days left, and
// a past one has none.
const sprintWorkingDays = ({ start, end }, today) => {
  const startDay = toUtcDay(start);
  const from = toUtcDay(today).getTime() > startDay.getTime() ? today : startDay;

  return {
    total: countWorkingDays(start, end),
    remaining: countWorkingDays(from, end),
  };
};

const SPRINT_BUCKETS = Object.freeze({
  DONE: 'done',
  IN_PROGRESS: 'inProgress',
  TODO: 'todo',
});

const idKey = (value) => {
  const id = value?._id ?? value?.id ?? value;
  return id === null || id === undefined ? null : String(id);
};

// A zeroed points/counts bucket in the shape every sprint aggregation returns.
// One definition, imported by `sprintSummaryData.js` and the summary service so
// the three of them cannot disagree about the shape.
const emptyBuckets = () => ({ done: 0, inProgress: 0, todo: 0, total: 0 });

// The status document a ticket points at, out of the workspace's status list.
// Resolved once and passed to `bucketSprintTicket` / `isSprintTicketBlocked` by a
// caller that needs both, so the `.find` is not run twice for one ticket.
const resolveTicketStatus = (ticket, statuses = []) => {
  const statusKey = idKey(ticket?.status);
  return statuses.find((candidate) => idKey(candidate) === statusKey) ?? null;
};

// Buckets read status FLAGS, never status names, so a renamed or custom
// workflow buckets the same way: `to do` is the workspace's first main
// (non-backlog) status, `done` is any status flagged done, and everything
// between them — staging, review, blocked — reads as in progress.
const firstMainStatusKey = (statuses = []) => {
  const main = statuses
    .filter((status) => !status?.isBacklog)
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));

  return main.length ? idKey(main[0]) : null;
};

// A workspace with no status flagged done simply has no done bucket — every
// ticket reads as to do or in progress and progress sits at 0%, rather than
// the aggregation throwing on a workflow somebody configured that way.
const bucketSprintTicket = (
  ticket,
  statuses = [],
  todoKey = firstMainStatusKey(statuses),
  status = resolveTicketStatus(ticket, statuses)
) => {
  if (status?.isDone) return SPRINT_BUCKETS.DONE;
  if (todoKey && idKey(ticket?.status) === todoKey) return SPRINT_BUCKETS.TODO;
  return SPRINT_BUCKETS.IN_PROGRESS;
};

// Archived tickets keep their sprint reference but are excluded from every
// aggregation, numerator and denominator alike, so cancelling work can never
// hold a sprint below 100%.
const countsTowardsSprint = (ticket) => !ticket?.isArchived;

// A blocker RECORD on the ticket — the "why", which is optional. A ticket can
// sit in Blocked with nothing written down, and a ticket in any status can carry
// a recorded blocker, so this is only half of the question.
const hasRecordedBlocker = (ticket) =>
  Boolean(ticket?.blockedBy?.ticket || ticket?.blockedBy?.note?.trim());

// Blocked as the board means it: the ticket sits in the Blocked status, whether
// or not anybody recorded a reason. Read off the status SLUG, never the label,
// so a workspace that renamed the column keeps counting (`helpers/ticketBlocker.js`).
// The recorded blocker is kept as a second route in, because a ticket parked in
// another column with a written-down blocker is stuck just the same. `status` may
// be passed pre-resolved by a caller that already looked it up for the bucket.
const isSprintTicketBlocked = (
  ticket,
  statuses = [],
  status = resolveTicketStatus(ticket, statuses)
) => isBlockedStatusSlug(status?.slug) || hasRecordedBlocker(ticket);

// Past its due date and not finished. A ticket finished after its due date
// stops counting — the number only shows what somebody can still act on.
const isOverdue = (ticket, today, bucket) => {
  if (bucket === SPRINT_BUCKETS.DONE) return false;
  if (!ticket?.dueDate) return false;
  return toUtcDay(ticket.dueDate).getTime() < toUtcDay(today).getTime();
};

// Progress is done story points over total story points (ADR 0011). Ticket
// counts ride along because the strip displays them, but they are not what the
// bar measures. An unestimated ticket contributes zero points and one ticket.
const sprintProgress = (tickets = [], statuses = []) => {
  const todoKey = firstMainStatusKey(statuses);
  const points = emptyBuckets();
  const ticketCounts = emptyBuckets();

  tickets.filter(countsTowardsSprint).forEach((ticket) => {
    const bucket = bucketSprintTicket(ticket, statuses, todoKey);
    const estimate = typeof ticket?.storyPoints === 'number' ? ticket.storyPoints : 0;

    points[bucket] += estimate;
    points.total += estimate;
    ticketCounts[bucket] += 1;
    ticketCounts.total += 1;
  });

  return {
    percent: points.total ? Math.round((points.done / points.total) * 100) : 0,
    points,
    tickets: ticketCounts,
  };
};

// One ticket needing attention is one ticket, counted once, even when both
// reasons apply — so `blocked + overdue` can exceed `total` on purpose, and
// both reasons stay available for the detail line.
const sprintNeedsAttention = (tickets = [], statuses = [], today) => {
  const todoKey = firstMainStatusKey(statuses);
  let total = 0;
  let blocked = 0;
  let overdue = 0;

  tickets.filter(countsTowardsSprint).forEach((ticket) => {
    const status = resolveTicketStatus(ticket, statuses);
    const bucket = bucketSprintTicket(ticket, statuses, todoKey, status);
    const isBlocked = isSprintTicketBlocked(ticket, statuses, status);
    const isLate = isOverdue(ticket, today, bucket);

    if (isBlocked) blocked += 1;
    if (isLate) overdue += 1;
    if (isBlocked || isLate) total += 1;
  });

  return { total, blocked, overdue };
};

// The whole derived block a sprint read carries, so the frontend computes none
// of it: how far along the sprint is, how long is left, and what is stuck.
const sprintMetrics = (sprint, { tickets = [], statuses = [] } = {}, today) => ({
  progress: sprintProgress(tickets, statuses),
  workingDays: sprintWorkingDays(sprint, today),
  needsAttention: sprintNeedsAttention(tickets, statuses, today),
});

// Which numbers a sprint read should return, and whether reading it has to write
// anything down. See ADR 0012.
//
// A running sprint's numbers follow its board, so they are recomputed on every
// read and nothing is stored. A finished one cannot work that way: membership is
// a single reference on the ticket, so carrying a leftover forward takes the
// ticket out of the sprint that failed to deliver it and quietly improves that
// sprint's record. So the first read after a sprint's end date SEALS it — the
// live numbers are computed one last time and returned as the seal to persist —
// and every read after that serves the seal untouched.
//
// The seal is produced by `sprintMetrics`, the same helper that computes the
// live numbers, so a live sprint and a sealed one can never disagree about what
// the numbers mean.
//
// Pure: it decides, and returns `seal` for the caller to persist. It never
// writes. `seal` is null whenever nothing needs writing — which is the common
// case, since a sprint is sealed exactly once in its life.
const resolveSprintMetrics = (sprint, { tickets = [], statuses = [] } = {}, today) => {
  const isPast = deriveSprintState(sprint, today) === SPRINT_STATES.PAST;
  const sealed = sprint?.snapshot;

  // Already sealed — served unchanged, never recomputed and never resealed.
  if (isPast && sealed) {
    return {
      metrics: {
        progress: sealed.progress,
        workingDays: sealed.workingDays,
        needsAttention: sealed.needsAttention,
      },
      seal: null,
    };
  }

  const metrics = sprintMetrics(sprint, { tickets, statuses }, today);

  // Upcoming and active sprints are never sealed; their numbers stay live.
  if (!isPast) return { metrics, seal: null };

  return { metrics, seal: { ...metrics, sealedAt: new Date(today) } };
};

// ---------------------------------------------------------------------------
// Rollover — what happens when a sprint ends and nothing follows it.
//
// Pure, like everything else here: these two decide, and the service writes.
// See ADR 0014.
// ---------------------------------------------------------------------------

// Which of a finished sprint's tickets follow it into the next one.
//
// Buckets come from `bucketSprintTicket`, so "done" is the status FLAG and never
// a status name — a workspace that renamed its done column, or has none at all,
// behaves identically. That shared helper is the point: the carry and the sprint
// numbers cannot end up disagreeing about which tickets were finished.
//
// Done stays, because a finished ticket belongs to the sprint that finished it.
// Archived stays, because `countsTowardsSprint` already excludes it from every
// sprint number and carrying it would put cancelled work back on the board.
// Everything else follows — to do, in progress, review, and blocked most of all,
// since a blocked ticket is exactly the work that has to come with you.
//
// Statuses are NOT rewritten. A carried ticket keeps the column it reached,
// which is what makes this a membership change with no transition to run.
const partitionSprintCarry = (tickets = [], statuses = []) => {
  const todoKey = firstMainStatusKey(statuses);
  const carry = [];
  const stay = [];

  tickets.forEach((ticket) => {
    const id = idKey(ticket);
    if (!id) return;

    if (!countsTowardsSprint(ticket)) {
      stay.push(id);
      return;
    }

    const bucket = bucketSprintTicket(ticket, statuses, todoKey);
    (bucket === SPRINT_BUCKETS.DONE ? stay : carry).push(id);
  });

  return { carry, stay };
};

// Whether a workspace is due a new sprint, and what its window would be.
// Returns null — meaning "do nothing" — far more often than not.
//
// `{ endedSprint, window }` when every sprint in the workspace is past and the
// most recent one ended recently enough to still be a cadence.
//
// The four ways this returns null are each load-bearing:
//
//  - An ACTIVE or UPCOMING sprint exists. One test covers both, because either
//    one means the workspace already has a next sprint: the team is working in
//    it, or the team planned it. Pouring tickets nobody chose into a sprint
//    somebody did plan is worse than doing nothing, and the create modal's
//    leftovers tab stays the only way in.
//  - No sprints at all. Rollover continues a cadence; it does not start one.
//  - The workspace has gone DORMANT. Without this a workspace that ran one
//    sprint in March and stopped would grow a fresh empty sprint every fortnight
//    forever, off nothing but a page load. One sprint length of grace: past
//    that, the team has stopped running sprints and a read must not restart them.
//  - The workspace turned it off (`autoRollover: false`).
const resolveRollover = (
  sprints = [],
  today,
  { lengthDays = DEFAULT_SPRINT_DAYS, autoRollover = true } = {}
) => {
  if (!autoRollover) return null;

  const dated = sprints.filter((sprint) => sprint?.start && sprint?.end);
  if (dated.length === 0) return null;

  // Anything not past is a successor already, whether it is running or planned.
  if (dated.some((sprint) => deriveSprintState(sprint, today) !== SPRINT_STATES.PAST)) {
    return null;
  }

  const endedSprint = latestEndingSprint(dated);
  const length = clampSprintLength(lengthDays);

  if (dayDiff(today, endedSprint.end) > length) return null;

  return { endedSprint, window: defaultSprintWindow(endedSprint, today, length) };
};

module.exports = {
  MIN_SPRINT_DAYS,
  MAX_SPRINT_DAYS,
  DEFAULT_SPRINT_DAYS,
  SPRINT_STATES,
  SPRINT_ESTIMATE_REQUIRED,
  SPRINT_NOT_EDITABLE,
  SPRINT_NOT_DELETABLE,
  SprintValidationError,
  SprintOverlapError,
  SprintNotMutableError,
  toUtcDay,
  addDays,
  clampSprintLength,
  deriveSprintState,
  pickSprintToShow,
  validateSprintDates,
  sprintsOverlap,
  findOverlappingSprint,
  latestEndingSprint,
  defaultSprintWindow,
  resolveSprintWindow,
  canEditSprint,
  canDeleteSprint,
  sprintPermissions,
  assertSprintEditable,
  assertSprintDeletable,
  hasSprintEstimate,
  assertTicketMayJoinSprint,
  SPRINT_BUCKETS,
  countWorkingDays,
  sprintWorkingDays,
  emptyBuckets,
  idKey,
  countsTowardsSprint,
  resolveTicketStatus,
  firstMainStatusKey,
  bucketSprintTicket,
  hasRecordedBlocker,
  isSprintTicketBlocked,
  sprintProgress,
  sprintNeedsAttention,
  sprintMetrics,
  resolveSprintMetrics,
  partitionSprintCarry,
  resolveRollover,
};
