// Pure, clock-free rules for Sprints. `today` is always injected, never read
// from the system clock, so every date test is deterministic and none needs
// fake timers. See ADR 0010 — a sprint stores only its dates; state, overlap
// and validation are all derived here rather than stored.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MIN_SPRINT_DAYS = 7; // one week
const MAX_SPRINT_DAYS = 56; // eight weeks

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

module.exports = {
  MIN_SPRINT_DAYS,
  MAX_SPRINT_DAYS,
  SPRINT_STATES,
  SPRINT_ESTIMATE_REQUIRED,
  SPRINT_NOT_EDITABLE,
  SPRINT_NOT_DELETABLE,
  SprintValidationError,
  SprintOverlapError,
  SprintNotMutableError,
  toUtcDay,
  deriveSprintState,
  pickSprintToShow,
  validateSprintDates,
  sprintsOverlap,
  findOverlappingSprint,
  canEditSprint,
  canDeleteSprint,
  sprintPermissions,
  assertSprintEditable,
  assertSprintDeletable,
  hasSprintEstimate,
  assertTicketMayJoinSprint,
};
