const {
  SPRINT_STATES,
  SPRINT_ESTIMATE_REQUIRED,
  SprintValidationError,
  SprintNotMutableError,
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
} = require('./sprintRules');

const day = (isoDate) => new Date(`${isoDate}T00:00:00.000Z`);

describe('deriveSprintState', () => {
  const sprint = { start: day('2026-09-01'), end: day('2026-09-12') };

  it('is upcoming before the start date', () => {
    expect(deriveSprintState(sprint, day('2026-08-31'))).toBe(SPRINT_STATES.UPCOMING);
  });

  it('is active on the start date', () => {
    expect(deriveSprintState(sprint, day('2026-09-01'))).toBe(SPRINT_STATES.ACTIVE);
  });

  it('is active on the end date', () => {
    expect(deriveSprintState(sprint, day('2026-09-12'))).toBe(SPRINT_STATES.ACTIVE);
  });

  it('is active on a day in between', () => {
    expect(deriveSprintState(sprint, day('2026-09-06'))).toBe(SPRINT_STATES.ACTIVE);
  });

  it('is past after the end date', () => {
    expect(deriveSprintState(sprint, day('2026-09-13'))).toBe(SPRINT_STATES.PAST);
  });

  it('a sprint starting today is active', () => {
    const startsToday = { start: day('2026-09-01'), end: day('2026-09-08') };
    expect(deriveSprintState(startsToday, day('2026-09-01'))).toBe(SPRINT_STATES.ACTIVE);
  });
});

describe('pickSprintToShow', () => {
  it('picks the active sprint over any upcoming one', () => {
    const active = { id: 'active', start: day('2026-09-01'), end: day('2026-09-08') };
    const upcoming = { id: 'upcoming', start: day('2026-09-09'), end: day('2026-09-16') };
    expect(pickSprintToShow([upcoming, active], day('2026-09-03'))).toBe(active);
  });

  it('picks the soonest upcoming sprint when none is active', () => {
    const later = { id: 'later', start: day('2026-10-01'), end: day('2026-10-08') };
    const soonest = { id: 'soonest', start: day('2026-09-09'), end: day('2026-09-16') };
    expect(pickSprintToShow([later, soonest], day('2026-09-03'))).toBe(soonest);
  });

  it('returns null with no active or upcoming sprint', () => {
    const past = { id: 'past', start: day('2026-08-01'), end: day('2026-08-08') };
    expect(pickSprintToShow([past], day('2026-09-03'))).toBeNull();
  });

  it('returns null given no sprints', () => {
    expect(pickSprintToShow([], day('2026-09-03'))).toBeNull();
  });
});

describe('validateSprintDates', () => {
  const today = day('2026-09-01');

  it('accepts a well-formed new sprint', () => {
    expect(() =>
      validateSprintDates({ start: day('2026-09-01'), end: day('2026-09-12') }, today)
    ).not.toThrow();
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      validateSprintDates({ start: day('2026-09-12'), end: day('2026-09-01') }, today)
    ).toThrow(SprintValidationError);
  });

  it('accepts equal start and end dates paired with the minimum length rule', () => {
    // A one-day sprint is still refused on length, but not on end-before-start.
    expect(() =>
      validateSprintDates({ start: day('2026-09-01'), end: day('2026-09-01') }, today)
    ).toThrow('at least one week');
  });

  it('rejects a new sprint starting in the past', () => {
    expect(() =>
      validateSprintDates({ start: day('2026-08-31'), end: day('2026-09-10') }, today)
    ).toThrow('may not start in the past');
  });

  it('does not apply the no-backdating rule to an existing sprint', () => {
    expect(() =>
      validateSprintDates({ start: day('2026-08-01'), end: day('2026-08-14') }, today, {
        isNew: false,
      })
    ).not.toThrow();
  });

  it('rejects a sprint shorter than one week', () => {
    expect(() =>
      validateSprintDates({ start: day('2026-09-01'), end: day('2026-09-05') }, today)
    ).toThrow('at least one week');
  });

  it('accepts a sprint exactly one week long', () => {
    expect(() =>
      validateSprintDates({ start: day('2026-09-01'), end: day('2026-09-07') }, today)
    ).not.toThrow();
  });

  it('accepts a sprint exactly eight weeks long', () => {
    expect(() =>
      validateSprintDates({ start: day('2026-09-01'), end: day('2026-10-26') }, today)
    ).not.toThrow();
  });

  it('rejects a sprint longer than eight weeks', () => {
    expect(() =>
      validateSprintDates({ start: day('2026-09-01'), end: day('2026-10-27') }, today)
    ).toThrow('more than eight weeks');
  });
});

describe('sprintsOverlap', () => {
  it('is false for two sprints with a gap between them', () => {
    const a = { start: day('2026-09-01'), end: day('2026-09-08') };
    const b = { start: day('2026-09-10'), end: day('2026-09-17') };
    expect(sprintsOverlap(a, b)).toBe(false);
  });

  it('is true when they share only an endpoint', () => {
    const a = { start: day('2026-09-01'), end: day('2026-09-08') };
    const b = { start: day('2026-09-08'), end: day('2026-09-15') };
    expect(sprintsOverlap(a, b)).toBe(true);
  });

  it('is true when one sprint fully contains the other', () => {
    const outer = { start: day('2026-09-01'), end: day('2026-09-30') };
    const inner = { start: day('2026-09-10'), end: day('2026-09-12') };
    expect(sprintsOverlap(outer, inner)).toBe(true);
  });

  it('is true for a partial overlap', () => {
    const a = { start: day('2026-09-01'), end: day('2026-09-10') };
    const b = { start: day('2026-09-05'), end: day('2026-09-15') };
    expect(sprintsOverlap(a, b)).toBe(true);
  });

  it('is order-independent', () => {
    const a = { start: day('2026-09-01'), end: day('2026-09-10') };
    const b = { start: day('2026-09-05'), end: day('2026-09-15') };
    expect(sprintsOverlap(b, a)).toBe(true);
  });
});

describe('findOverlappingSprint', () => {
  it('returns the specific sprint a candidate collides with', () => {
    const candidate = { start: day('2026-09-01'), end: day('2026-09-10') };
    const other = { name: 'Sprint 3', start: day('2026-08-01'), end: day('2026-08-31') };
    const colliding = { name: 'Sprint 4', start: day('2026-09-05'), end: day('2026-09-20') };
    expect(findOverlappingSprint(candidate, [other, colliding])).toBe(colliding);
  });

  it('returns null when nothing collides', () => {
    const candidate = { start: day('2026-09-01'), end: day('2026-09-10') };
    const other = { name: 'Sprint 3', start: day('2026-08-01'), end: day('2026-08-31') };
    expect(findOverlappingSprint(candidate, [other])).toBeNull();
  });

  it('does not report a sprint being edited as overlapping itself', () => {
    const existing = {
      _id: 's1',
      name: 'Sprint 4',
      start: day('2026-09-01'),
      end: day('2026-09-14'),
    };
    const edited = { _id: 's1', start: day('2026-09-01'), end: day('2026-09-21') };
    expect(findOverlappingSprint(edited, [existing])).toBeNull();
  });

  it('still catches an edit that collides with a different sprint', () => {
    const edited = { _id: 's1', start: day('2026-09-01'), end: day('2026-09-21') };
    const itself = {
      _id: 's1',
      name: 'Sprint 4',
      start: day('2026-09-01'),
      end: day('2026-09-14'),
    };
    const neighbour = {
      _id: 's2',
      name: 'Sprint 5',
      start: day('2026-09-15'),
      end: day('2026-09-28'),
    };
    expect(findOverlappingSprint(edited, [itself, neighbour])).toBe(neighbour);
  });
});

describe('sprint mutability', () => {
  const today = day('2026-09-06');
  const upcoming = { start: day('2026-09-14'), end: day('2026-09-25') };
  const active = { start: day('2026-09-01'), end: day('2026-09-12') };
  const past = { start: day('2026-08-01'), end: day('2026-08-14') };
  const startsToday = { start: day('2026-09-06'), end: day('2026-09-18') };

  it('an upcoming sprint may be edited and deleted', () => {
    expect(sprintPermissions(upcoming, today)).toEqual({ canEdit: true, canDelete: true });
  });

  it('an active sprint may be edited but not deleted', () => {
    expect(sprintPermissions(active, today)).toEqual({ canEdit: true, canDelete: false });
  });

  it('a past sprint may be neither edited nor deleted', () => {
    expect(sprintPermissions(past, today)).toEqual({ canEdit: false, canDelete: false });
  });

  it('a sprint starting today is active and therefore not deletable', () => {
    expect(deriveSprintState(startsToday, today)).toBe(SPRINT_STATES.ACTIVE);
    expect(canDeleteSprint(startsToday, today)).toBe(false);
    expect(canEditSprint(startsToday, today)).toBe(true);
  });

  it('a sprint ending today is still active and therefore not deletable', () => {
    const endsToday = { start: day('2026-08-24'), end: day('2026-09-06') };
    expect(canDeleteSprint(endsToday, today)).toBe(false);
  });

  it('becomes deletable once its start is moved into the future', () => {
    // The escape hatch for a sprint created with today's date by mistake.
    const moved = { start: day('2026-09-07'), end: day('2026-09-18') };
    expect(canDeleteSprint(moved, today)).toBe(true);
  });
});

describe('assertSprintEditable', () => {
  const today = day('2026-09-06');

  it('lets an active sprint through', () => {
    expect(() =>
      assertSprintEditable({ start: day('2026-09-01'), end: day('2026-09-12') }, today)
    ).not.toThrow();
  });

  it('refuses a past sprint', () => {
    expect(() =>
      assertSprintEditable({ start: day('2026-08-01'), end: day('2026-08-14') }, today)
    ).toThrow(SprintNotMutableError);
  });
});

describe('assertSprintDeletable', () => {
  const today = day('2026-09-06');

  it('lets an upcoming sprint through', () => {
    expect(() =>
      assertSprintDeletable({ start: day('2026-09-14'), end: day('2026-09-25') }, today)
    ).not.toThrow();
  });

  it('refuses an active sprint, saying how to get out of it', () => {
    expect(() =>
      assertSprintDeletable({ start: day('2026-09-01'), end: day('2026-09-12') }, today)
    ).toThrow(SprintNotMutableError);
    expect(() =>
      assertSprintDeletable({ start: day('2026-09-01'), end: day('2026-09-12') }, today)
    ).toThrow('Move its start date into the future');
  });

  it('refuses a past sprint', () => {
    expect(() =>
      assertSprintDeletable({ start: day('2026-08-01'), end: day('2026-08-14') }, today)
    ).toThrow(SprintNotMutableError);
  });
});

describe('hasSprintEstimate', () => {
  it('accepts a ticket carrying story points', () => {
    expect(hasSprintEstimate({ storyPoints: 3 })).toBe(true);
  });

  it('rejects a ticket whose story points were never set', () => {
    expect(hasSprintEstimate({ storyPoints: null })).toBe(false);
  });

  it('rejects a ticket with no story points field at all', () => {
    expect(hasSprintEstimate({})).toBe(false);
  });

  it('rejects a zero estimate, which measures the same as no estimate', () => {
    expect(hasSprintEstimate({ storyPoints: 0 })).toBe(false);
  });
});

describe('assertTicketMayJoinSprint', () => {
  it('passes an estimated ticket through', () => {
    expect(() => assertTicketMayJoinSprint({ storyPoints: 1 })).not.toThrow();
  });

  it('refuses an unestimated ticket, naming what is missing', () => {
    expect(() => assertTicketMayJoinSprint({ storyPoints: null })).toThrow(SprintValidationError);
    expect(() => assertTicketMayJoinSprint({ storyPoints: null })).toThrow(
      SPRINT_ESTIMATE_REQUIRED
    );
  });
});

// --- Aggregations over a sprint's tickets ----------------------------------

const {
  SPRINT_BUCKETS,
  countWorkingDays,
  sprintWorkingDays,
  bucketSprintTicket,
  hasRecordedBlocker,
  sprintProgress,
  sprintNeedsAttention,
  sprintMetrics,
} = require('./sprintRules');

// A default workspace workflow: one backlog status, then to do, in progress,
// blocked, and done. Bucketing reads the flags, never these labels.
const DEFAULT_STATUSES = [
  { _id: 'backlog', label: 'Backlog', sortOrder: 0, isBacklog: true },
  { _id: 'todo', label: 'To do', sortOrder: 1 },
  { _id: 'doing', label: 'In progress', sortOrder: 2 },
  { _id: 'blocked', label: 'Blocked', sortOrder: 3 },
  { _id: 'done', label: 'Done', sortOrder: 4, isDone: true },
];

const ticket = (overrides = {}) => ({ status: 'todo', storyPoints: 1, ...overrides });

describe('countWorkingDays', () => {
  it('counts Monday to Friday inclusive of both ends', () => {
    expect(countWorkingDays(day('2026-09-07'), day('2026-09-11'))).toBe(5);
  });

  it('skips the weekend inside a range', () => {
    // Mon 7 Sep to Fri 18 Sep spans one full weekend: 10 working days of 12.
    expect(countWorkingDays(day('2026-09-07'), day('2026-09-18'))).toBe(10);
  });

  it('does not count a Saturday end date', () => {
    expect(countWorkingDays(day('2026-09-07'), day('2026-09-12'))).toBe(5);
  });

  it('counts a weekend-only range as no working days', () => {
    expect(countWorkingDays(day('2026-09-12'), day('2026-09-13'))).toBe(0);
  });

  it('counts nothing when the end precedes the start', () => {
    expect(countWorkingDays(day('2026-09-11'), day('2026-09-07'))).toBe(0);
  });
});

describe('sprintWorkingDays', () => {
  const sprint = { start: day('2026-09-07'), end: day('2026-09-18') };

  it('counts from today once the sprint is running', () => {
    // Mon 14 Sep to Fri 18 Sep is the second week.
    expect(sprintWorkingDays(sprint, day('2026-09-14'))).toEqual({ total: 10, remaining: 5 });
  });

  it('leaves an upcoming sprint all of its days', () => {
    expect(sprintWorkingDays(sprint, day('2026-09-01'))).toEqual({ total: 10, remaining: 10 });
  });

  it('leaves a past sprint none', () => {
    expect(sprintWorkingDays(sprint, day('2026-09-21'))).toEqual({ total: 10, remaining: 0 });
  });

  it('counts the last day of the sprint as remaining', () => {
    expect(sprintWorkingDays(sprint, day('2026-09-18')).remaining).toBe(1);
  });

  it('reports a sprint ending on a Saturday by its working days only', () => {
    const endsSaturday = { start: day('2026-09-07'), end: day('2026-09-12') };
    expect(sprintWorkingDays(endsSaturday, day('2026-09-07'))).toEqual({
      total: 5,
      remaining: 5,
    });
  });

  it('reports no days remaining from inside the weekend a sprint ends on', () => {
    const endsSaturday = { start: day('2026-09-07'), end: day('2026-09-12') };
    expect(sprintWorkingDays(endsSaturday, day('2026-09-12')).remaining).toBe(0);
  });
});

describe('bucketSprintTicket', () => {
  it('buckets a status flagged done as done', () => {
    expect(bucketSprintTicket(ticket({ status: 'done' }), DEFAULT_STATUSES)).toBe(
      SPRINT_BUCKETS.DONE
    );
  });

  it('buckets the first main status as to do', () => {
    expect(bucketSprintTicket(ticket({ status: 'todo' }), DEFAULT_STATUSES)).toBe(
      SPRINT_BUCKETS.TODO
    );
  });

  it('buckets a blocked status as in progress, not as its own thing', () => {
    expect(bucketSprintTicket(ticket({ status: 'blocked' }), DEFAULT_STATUSES)).toBe(
      SPRINT_BUCKETS.IN_PROGRESS
    );
  });

  it('ignores the backlog status when choosing the to-do column', () => {
    expect(bucketSprintTicket(ticket({ status: 'backlog' }), DEFAULT_STATUSES)).toBe(
      SPRINT_BUCKETS.IN_PROGRESS
    );
  });

  it('reads a populated status object as well as a bare id', () => {
    expect(bucketSprintTicket(ticket({ status: { _id: 'done' } }), DEFAULT_STATUSES)).toBe(
      SPRINT_BUCKETS.DONE
    );
  });
});

describe('sprintProgress', () => {
  it('measures done points over total points', () => {
    const tickets = [
      ticket({ status: 'done', storyPoints: 5 }),
      ticket({ status: 'done', storyPoints: 3 }),
      ticket({ status: 'doing', storyPoints: 2 }),
      ticket({ status: 'todo', storyPoints: 2 }),
    ];

    const progress = sprintProgress(tickets, DEFAULT_STATUSES);

    expect(progress.points).toEqual({ done: 8, inProgress: 2, todo: 2, total: 12 });
    expect(progress.tickets).toEqual({ done: 2, inProgress: 1, todo: 1, total: 4 });
    expect(progress.percent).toBe(67);
  });

  it('sits at 0% when no ticket is done', () => {
    const tickets = [
      ticket({ status: 'todo', storyPoints: 3 }),
      ticket({ status: 'doing', storyPoints: 2 }),
    ];

    expect(sprintProgress(tickets, DEFAULT_STATUSES).percent).toBe(0);
  });

  it('reaches 100% when every ticket is done', () => {
    const tickets = [
      ticket({ status: 'done', storyPoints: 3 }),
      ticket({ status: 'done', storyPoints: 2 }),
    ];

    const progress = sprintProgress(tickets, DEFAULT_STATUSES);
    expect(progress.percent).toBe(100);
    expect(progress.points.total).toBe(5);
  });

  it('excludes archived tickets from numerator and denominator alike', () => {
    const tickets = [
      ticket({ status: 'done', storyPoints: 3 }),
      ticket({ status: 'todo', storyPoints: 5, isArchived: true }),
    ];

    const progress = sprintProgress(tickets, DEFAULT_STATUSES);

    expect(progress.points).toEqual({ done: 3, inProgress: 0, todo: 0, total: 3 });
    expect(progress.tickets.total).toBe(1);
    expect(progress.percent).toBe(100);
  });

  it('reports an empty sprint rather than dividing by zero when every ticket is archived', () => {
    const tickets = [
      ticket({ status: 'todo', storyPoints: 3, isArchived: true }),
      ticket({ status: 'done', storyPoints: 2, isArchived: true }),
    ];

    const progress = sprintProgress(tickets, DEFAULT_STATUSES);

    expect(progress.percent).toBe(0);
    expect(progress.points.total).toBe(0);
    expect(progress.tickets.total).toBe(0);
  });

  it('buckets a workspace with custom statuses by their flags, not their names', () => {
    const customStatuses = [
      { _id: 'icebox', label: 'Icebox', sortOrder: 0, isBacklog: true },
      { _id: 'ready', label: 'Ready to pick up', sortOrder: 1 },
      { _id: 'building', label: 'Building', sortOrder: 2 },
      { _id: 'staging', label: 'On staging', sortOrder: 3 },
      { _id: 'shipped', label: 'Shipped', sortOrder: 4, isDone: true },
    ];
    const tickets = [
      ticket({ status: 'ready', storyPoints: 1 }),
      ticket({ status: 'building', storyPoints: 2 }),
      ticket({ status: 'staging', storyPoints: 3 }),
      ticket({ status: 'shipped', storyPoints: 4 }),
    ];

    const progress = sprintProgress(tickets, customStatuses);

    expect(progress.points).toEqual({ done: 4, inProgress: 5, todo: 1, total: 10 });
    expect(progress.percent).toBe(40);
  });

  it('leaves the done bucket empty when the workspace configured no done status', () => {
    const noDoneStatuses = [
      { _id: 'backlog', label: 'Backlog', sortOrder: 0, isBacklog: true },
      { _id: 'todo', label: 'To do', sortOrder: 1 },
      { _id: 'doing', label: 'In progress', sortOrder: 2 },
    ];
    const tickets = [
      ticket({ status: 'todo', storyPoints: 2 }),
      ticket({ status: 'doing', storyPoints: 3 }),
    ];

    const progress = sprintProgress(tickets, noDoneStatuses);

    expect(progress.points).toEqual({ done: 0, inProgress: 3, todo: 2, total: 5 });
    expect(progress.percent).toBe(0);
  });

  it('counts an unestimated ticket as a ticket worth no points', () => {
    const tickets = [
      ticket({ status: 'done', storyPoints: 3 }),
      ticket({ status: 'todo', storyPoints: null }),
    ];

    const progress = sprintProgress(tickets, DEFAULT_STATUSES);

    expect(progress.points.total).toBe(3);
    expect(progress.tickets.total).toBe(2);
  });
});

describe('hasRecordedBlocker', () => {
  it('sees a blocker recorded as another ticket', () => {
    expect(hasRecordedBlocker({ blockedBy: { ticket: 'abc', note: '' } })).toBe(true);
  });

  it('sees a blocker recorded as a note', () => {
    expect(hasRecordedBlocker({ blockedBy: { ticket: null, note: 'waiting on legal' } })).toBe(
      true
    );
  });

  it('does not mistake the blocked STATUS for a recorded blocker', () => {
    expect(hasRecordedBlocker({ status: 'blocked', blockedBy: { ticket: null, note: '' } })).toBe(
      false
    );
  });
});

describe('sprintNeedsAttention', () => {
  const today = day('2026-09-14');

  it('counts a ticket carrying a recorded blocker', () => {
    const tickets = [ticket({ blockedBy: { note: 'waiting on the vendor' } }), ticket()];

    expect(sprintNeedsAttention(tickets, DEFAULT_STATUSES, today)).toEqual({
      total: 1,
      blocked: 1,
      overdue: 0,
    });
  });

  it('counts an unfinished ticket past its due date', () => {
    const tickets = [
      ticket({ dueDate: day('2026-09-11') }),
      ticket({ dueDate: day('2026-09-20') }),
    ];

    expect(sprintNeedsAttention(tickets, DEFAULT_STATUSES, today)).toEqual({
      total: 1,
      blocked: 0,
      overdue: 1,
    });
  });

  it('does not count a ticket due today as overdue', () => {
    const tickets = [ticket({ dueDate: today })];

    expect(sprintNeedsAttention(tickets, DEFAULT_STATUSES, today).overdue).toBe(0);
  });

  it('stops counting a ticket finished after its due date', () => {
    const tickets = [ticket({ status: 'done', dueDate: day('2026-09-01') })];

    expect(sprintNeedsAttention(tickets, DEFAULT_STATUSES, today)).toEqual({
      total: 0,
      blocked: 0,
      overdue: 0,
    });
  });

  it('counts a ticket that is both blocked and overdue once, keeping both reasons', () => {
    const tickets = [
      ticket({ dueDate: day('2026-09-01'), blockedBy: { note: 'waiting on the vendor' } }),
    ];

    expect(sprintNeedsAttention(tickets, DEFAULT_STATUSES, today)).toEqual({
      total: 1,
      blocked: 1,
      overdue: 1,
    });
  });

  it('excludes archived tickets', () => {
    const tickets = [
      ticket({ isArchived: true, dueDate: day('2026-09-01') }),
      ticket({ isArchived: true, blockedBy: { note: 'dropped' } }),
    ];

    expect(sprintNeedsAttention(tickets, DEFAULT_STATUSES, today)).toEqual({
      total: 0,
      blocked: 0,
      overdue: 0,
    });
  });

  it('still counts a blocker on a ticket the workspace has no done status for', () => {
    const noDoneStatuses = [
      { _id: 'todo', label: 'To do', sortOrder: 1 },
      { _id: 'doing', label: 'In progress', sortOrder: 2 },
    ];
    const tickets = [ticket({ dueDate: day('2026-09-01') })];

    expect(sprintNeedsAttention(tickets, noDoneStatuses, today).overdue).toBe(1);
  });
});

describe('sprintMetrics', () => {
  it('carries progress, working days and needs attention in one block', () => {
    const sprint = { start: day('2026-09-07'), end: day('2026-09-18') };
    const tickets = [
      ticket({ status: 'done', storyPoints: 5 }),
      ticket({ status: 'doing', storyPoints: 3, blockedBy: { note: 'waiting' } }),
      ticket({ status: 'todo', storyPoints: 2, dueDate: day('2026-09-10') }),
      ticket({ status: 'todo', storyPoints: 5, isArchived: true }),
    ];

    const metrics = sprintMetrics(
      sprint,
      { tickets, statuses: DEFAULT_STATUSES },
      day('2026-09-14')
    );

    expect(metrics.progress.percent).toBe(50);
    expect(metrics.progress.tickets.total).toBe(3);
    expect(metrics.workingDays).toEqual({ total: 10, remaining: 5 });
    expect(metrics.needsAttention).toEqual({ total: 2, blocked: 1, overdue: 1 });
  });

  it('reports an empty sprint as zeros rather than throwing', () => {
    const sprint = { start: day('2026-09-07'), end: day('2026-09-18') };

    const metrics = sprintMetrics(sprint, {}, day('2026-09-07'));

    expect(metrics.progress.percent).toBe(0);
    expect(metrics.progress.tickets.total).toBe(0);
    expect(metrics.needsAttention.total).toBe(0);
  });
});
