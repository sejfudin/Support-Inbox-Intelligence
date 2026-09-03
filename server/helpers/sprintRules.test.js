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
  DEFAULT_SPRINT_DAYS,
  latestEndingSprint,
  defaultSprintWindow,
  resolveSprintWindow,
  resolveRollover,
  partitionSprintCarry,
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
  emptyBuckets,
  resolveTicketStatus,
  bucketSprintTicket,
  hasRecordedBlocker,
  isSprintTicketBlocked,
  sprintProgress,
  sprintNeedsAttention,
  sprintMetrics,
  resolveSprintMetrics,
} = require('./sprintRules');

// A default workspace workflow: one backlog status, then to do, in progress,
// blocked, and done. Bucketing reads the flags, never these labels — but
// needs-attention reads the `blocked` slug, so the fixtures carry slugs too.
const DEFAULT_STATUSES = [
  { _id: 'backlog', slug: 'backlog', label: 'Backlog', sortOrder: 0, isBacklog: true },
  { _id: 'todo', slug: 'to do', label: 'To do', sortOrder: 1 },
  { _id: 'doing', slug: 'in progress', label: 'In progress', sortOrder: 2 },
  { _id: 'blocked', slug: 'blocked', label: 'Blocked', sortOrder: 3 },
  { _id: 'done', slug: 'done', label: 'Done', sortOrder: 4, isDone: true },
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

  it('accepts a pre-resolved status and does not re-scan the list', () => {
    const done = DEFAULT_STATUSES.find((status) => status._id === 'done');
    // The ticket points at 'todo', but the caller passes the resolved 'done'
    // status — bucketing trusts what it is handed for the done/blocked check.
    expect(bucketSprintTicket(ticket({ status: 'todo' }), [], undefined, done)).toBe(
      SPRINT_BUCKETS.DONE
    );
  });
});

describe('resolveTicketStatus', () => {
  it('returns the matching status document for a bare id', () => {
    expect(resolveTicketStatus(ticket({ status: 'doing' }), DEFAULT_STATUSES)).toMatchObject({
      _id: 'doing',
      slug: 'in progress',
    });
  });

  it('returns the match for a populated status object too', () => {
    expect(
      resolveTicketStatus(ticket({ status: { _id: 'blocked' } }), DEFAULT_STATUSES)
    ).toMatchObject({ _id: 'blocked' });
  });

  it('is null when the ticket points at a status the workspace does not have', () => {
    expect(resolveTicketStatus(ticket({ status: 'ghost' }), DEFAULT_STATUSES)).toBeNull();
  });
});

describe('emptyBuckets', () => {
  it('is a fresh zeroed done/inProgress/todo/total object each call', () => {
    expect(emptyBuckets()).toEqual({ done: 0, inProgress: 0, todo: 0, total: 0 });
    const a = emptyBuckets();
    a.done = 5;
    expect(emptyBuckets().done).toBe(0);
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

  it('reads the record only, not the status the ticket sits in', () => {
    expect(hasRecordedBlocker({ status: 'blocked', blockedBy: { ticket: null, note: '' } })).toBe(
      false
    );
  });
});

describe('isSprintTicketBlocked', () => {
  it('counts a ticket in the Blocked status with no reason written down', () => {
    expect(
      isSprintTicketBlocked(
        { status: 'blocked', blockedBy: { ticket: null, note: '' } },
        DEFAULT_STATUSES
      )
    ).toBe(true);
  });

  it('reads the slug, so a renamed Blocked column still counts', () => {
    const renamed = [{ _id: 'stuck', slug: 'blocked', label: 'Stuck', sortOrder: 3 }];

    expect(isSprintTicketBlocked({ status: 'stuck' }, renamed)).toBe(true);
  });

  it('counts a recorded blocker on a ticket in another status', () => {
    expect(
      isSprintTicketBlocked({ status: 'doing', blockedBy: { note: 'waiting' } }, DEFAULT_STATUSES)
    ).toBe(true);
  });

  it('leaves an unblocked ticket alone', () => {
    expect(isSprintTicketBlocked({ status: 'doing' }, DEFAULT_STATUSES)).toBe(false);
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

  it('counts a ticket sitting in the Blocked status with no reason written down', () => {
    const tickets = [ticket({ status: 'blocked' }), ticket()];

    expect(sprintNeedsAttention(tickets, DEFAULT_STATUSES, today)).toEqual({
      total: 1,
      blocked: 1,
      overdue: 0,
    });
  });

  it('counts a ticket in Blocked that also carries a record once', () => {
    const tickets = [ticket({ status: 'blocked', blockedBy: { note: 'waiting on legal' } })];

    expect(sprintNeedsAttention(tickets, DEFAULT_STATUSES, today)).toEqual({
      total: 1,
      blocked: 1,
      overdue: 0,
    });
  });

  it('does not count a non-blocked ticket whose blocker record is empty', () => {
    const tickets = [ticket({ status: 'doing', blockedBy: { ticket: null, note: '' } })];

    expect(sprintNeedsAttention(tickets, DEFAULT_STATUSES, today)).toEqual({
      total: 0,
      blocked: 0,
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

// ADR 0012 — a past sprint's numbers are sealed on the first read after it ends,
// and served from the seal from then on. Sealing is the decision; persisting the
// returned `seal` is the caller's job, which is why these tests can be pure.
describe('resolveSprintMetrics', () => {
  const PAST_SPRINT = { _id: 'sprint-1', start: day('2026-09-07'), end: day('2026-09-18') };
  const AFTER_IT_ENDED = day('2026-09-21');

  const twoTickets = [
    ticket({ status: 'done', storyPoints: 3 }),
    ticket({ status: 'todo', storyPoints: 5 }),
  ];

  it('seals a past sprint that has never been sealed, and returns what it sealed', () => {
    const { metrics, seal } = resolveSprintMetrics(
      PAST_SPRINT,
      { tickets: twoTickets, statuses: DEFAULT_STATUSES },
      AFTER_IT_ENDED
    );

    // The seal is the live numbers, computed one last time — not a second
    // opinion about what a sprint's numbers are.
    expect(metrics).toEqual(
      sprintMetrics(
        PAST_SPRINT,
        { tickets: twoTickets, statuses: DEFAULT_STATUSES },
        AFTER_IT_ENDED
      )
    );
    expect(seal).toMatchObject(metrics);
    expect(seal.sealedAt).toEqual(AFTER_IT_ENDED);
    expect(metrics.progress.tickets.total).toBe(2);
    expect(metrics.progress.percent).toBe(38);
  });

  it('serves a sealed sprint from its seal, and does not reseal it', () => {
    const sealed = {
      ...PAST_SPRINT,
      snapshot: {
        sealedAt: day('2026-09-19'),
        progress: { percent: 38, points: { done: 3, inProgress: 0, todo: 5, total: 8 } },
        workingDays: { total: 10, remaining: 0 },
        needsAttention: { total: 0, blocked: 0, overdue: 0 },
      },
    };

    // Only one ticket is left — the other was carried into the next sprint,
    // which is exactly the drift the seal exists to stop.
    const { metrics, seal } = resolveSprintMetrics(
      sealed,
      { tickets: [ticket({ status: 'done', storyPoints: 3 })], statuses: DEFAULT_STATUSES },
      AFTER_IT_ENDED
    );

    expect(seal).toBeNull();
    expect(metrics.progress).toEqual(sealed.snapshot.progress);
    expect(metrics.progress.percent).toBe(38);
    expect(metrics.progress.points.total).toBe(8);
  });

  it('never seals an active sprint, and keeps its numbers live', () => {
    const duringTheSprint = day('2026-09-14');

    const { metrics, seal } = resolveSprintMetrics(
      PAST_SPRINT,
      { tickets: twoTickets, statuses: DEFAULT_STATUSES },
      duringTheSprint
    );

    expect(seal).toBeNull();
    expect(metrics.workingDays.remaining).toBe(5);
    expect(metrics.progress.percent).toBe(38);
  });

  it('never seals an upcoming sprint', () => {
    const beforeItStarts = day('2026-09-01');

    expect(resolveSprintMetrics(PAST_SPRINT, {}, beforeItStarts).seal).toBeNull();
  });

  it('seals a sprint on its first read even when it ended long ago and is now empty', () => {
    const { metrics, seal } = resolveSprintMetrics(PAST_SPRINT, {}, AFTER_IT_ENDED);

    expect(seal).not.toBeNull();
    expect(metrics.progress.percent).toBe(0);
    expect(metrics.workingDays.remaining).toBe(0);
  });

  it('is idempotent: resolving with the seal it produced returns the same numbers', () => {
    const first = resolveSprintMetrics(
      PAST_SPRINT,
      { tickets: twoTickets, statuses: DEFAULT_STATUSES },
      AFTER_IT_ENDED
    );

    const second = resolveSprintMetrics(
      { ...PAST_SPRINT, snapshot: first.seal },
      { tickets: [], statuses: DEFAULT_STATUSES },
      day('2026-10-05')
    );

    expect(second.seal).toBeNull();
    expect(second.metrics).toEqual(first.metrics);
  });
});

// ---------------------------------------------------------------------------
// Default dates and rollover.
// ---------------------------------------------------------------------------

// Inclusive length, the same way `validateSprintDates` measures it.
const lengthOf = ({ start, end }) =>
  Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

describe('latestEndingSprint', () => {
  it('is null for no sprints', () => {
    expect(latestEndingSprint([])).toBeNull();
  });

  it('picks the sprint ending latest, not the one starting latest', () => {
    // A long sprint can end after one that starts later, which is exactly the
    // case sorting by `start` would get wrong.
    const long = { _id: 'long', start: day('2026-09-01'), end: day('2026-10-26') };
    const short = { _id: 'short', start: day('2026-08-01'), end: day('2026-08-14') };
    expect(latestEndingSprint([short, long])).toBe(long);
  });

  it('ignores entries with no end date', () => {
    const real = { _id: 'real', start: day('2026-09-01'), end: day('2026-09-14') };
    expect(latestEndingSprint([{ _id: 'junk' }, real])).toBe(real);
  });
});

describe('defaultSprintWindow', () => {
  const today = day('2026-09-03');

  it('starts today when the workspace has no sprints', () => {
    const window = defaultSprintWindow(null, today);
    expect(window.start).toEqual(day('2026-09-03'));
  });

  it('is exactly two weeks, inclusive of both endpoints', () => {
    // The off-by-one that a length assertion is the only way to catch: `+ 14`
    // days produces a 15-day sprint that still passes every other rule.
    expect(lengthOf(defaultSprintWindow(null, today))).toBe(14);
    expect(DEFAULT_SPRINT_DAYS).toBe(14);
    expect(defaultSprintWindow(null, today).end).toEqual(day('2026-09-16'));
  });

  it('starts the day AFTER the last sprint ends, never on its end date', () => {
    // A shared endpoint is an overlap (`sprintsOverlap` is inclusive), so the
    // day after is the earliest legal start and sprints run back to back.
    const latest = { start: day('2026-09-01'), end: day('2026-09-14') };
    expect(defaultSprintWindow(latest, today).start).toEqual(day('2026-09-15'));
    expect(defaultSprintWindow(latest, today).end).toEqual(day('2026-09-28'));
  });

  it('starts today rather than backdating when the last sprint ended long ago', () => {
    // `validateSprintDates` refuses to backdate a new sprint, so "the day after
    // July" would be a window the create path rejects.
    const stale = { start: day('2026-07-01'), end: day('2026-07-14') };
    expect(defaultSprintWindow(stale, today).start).toEqual(day('2026-09-03'));
  });

  it('chains off an upcoming sprint when that is the one ending latest', () => {
    // The trap this whole helper exists for: defaulting off the ACTIVE sprint
    // while a planned one exists produces a window on top of the planned one.
    const active = { _id: 'active', start: day('2026-09-01'), end: day('2026-09-14') };
    const upcoming = { _id: 'upcoming', start: day('2026-09-15'), end: day('2026-09-28') };
    const window = defaultSprintWindow(latestEndingSprint([active, upcoming]), today);
    expect(window.start).toEqual(day('2026-09-29'));
  });

  it('honours a workspace cadence other than two weeks', () => {
    expect(lengthOf(defaultSprintWindow(null, today, 7))).toBe(7);
    expect(lengthOf(defaultSprintWindow(null, today, 21))).toBe(21);
  });

  it('clamps a cadence that could never produce a legal sprint', () => {
    // A stored 3 would otherwise make every defaulted create fail the one-week
    // minimum on a window the server itself picked.
    expect(lengthOf(defaultSprintWindow(null, today, 3))).toBe(7);
    expect(lengthOf(defaultSprintWindow(null, today, 400))).toBe(56);
    expect(lengthOf(defaultSprintWindow(null, today, undefined))).toBe(14);
  });

  it('produces a window that always passes validateSprintDates', () => {
    const latest = { start: day('2026-09-01'), end: day('2026-09-14') };
    expect(() =>
      validateSprintDates(defaultSprintWindow(latest, today), today, { isNew: true })
    ).not.toThrow();
    expect(() =>
      validateSprintDates(defaultSprintWindow(null, today), today, { isNew: true })
    ).not.toThrow();
  });
});

describe('resolveSprintWindow', () => {
  const today = day('2026-09-03');
  const latest = { start: day('2026-09-01'), end: day('2026-09-14') };

  it('passes both dates through untouched when both are given', () => {
    const window = resolveSprintWindow({ start: '2026-10-01', end: '2026-10-14' }, latest, today);
    expect(window.start).toEqual(day('2026-10-01'));
    expect(window.end).toEqual(day('2026-10-14'));
  });

  it('fills both from the cadence when neither is given', () => {
    expect(resolveSprintWindow({}, latest, today)).toEqual(defaultSprintWindow(latest, today));
    expect(resolveSprintWindow(undefined, latest, today)).toEqual(
      defaultSprintWindow(latest, today)
    );
  });

  it('runs the cadence from a start date given without an end', () => {
    const window = resolveSprintWindow({ start: '2026-11-02' }, latest, today);
    expect(window.start).toEqual(day('2026-11-02'));
    expect(window.end).toEqual(day('2026-11-15'));
    expect(lengthOf(window)).toBe(14);
  });

  it('starts an end-only sprint where the default would, not at today', () => {
    // Today would collide with the running sprint. The default start is the one
    // date that cannot.
    const window = resolveSprintWindow({ end: '2026-10-05' }, latest, today);
    expect(window.start).toEqual(day('2026-09-15'));
    expect(window.end).toEqual(day('2026-10-05'));
  });

  it('treats an empty string as absent, which is what a cleared picker sends', () => {
    expect(resolveSprintWindow({ start: '', end: '' }, latest, today)).toEqual(
      defaultSprintWindow(latest, today)
    );
  });

  it('does not rescue a window the rules refuse — it only fills blanks', () => {
    // Backwards dates stay backwards, so `validateSprintDates` still speaks.
    const window = resolveSprintWindow({ start: '2026-10-14', end: '2026-10-01' }, latest, today);
    expect(() => validateSprintDates(window, today, { isNew: true })).toThrow(
      SprintValidationError
    );
  });
});

describe('overlap, in the terms the brief asks for', () => {
  const today = day('2026-09-20');
  // A workspace mid-cadence: one finished sprint, one running.
  const pastSprint = { _id: 'past', start: day('2026-09-01'), end: day('2026-09-14') };
  const activeSprint = { _id: 'active', start: day('2026-09-15'), end: day('2026-09-28') };
  const existing = [pastSprint, activeSprint];

  it('refuses a new sprint landing on the sprint in progress', () => {
    const candidate = { start: day('2026-09-22'), end: day('2026-10-05') };
    expect(findOverlappingSprint(candidate, existing)).toBe(activeSprint);
  });

  it('refuses a new sprint landing on a finished sprint', () => {
    const candidate = { start: day('2026-09-08'), end: day('2026-09-21') };
    expect(findOverlappingSprint(candidate, existing)).toBe(pastSprint);
  });

  it('though a NEW sprint never gets as far as the past-overlap rule', () => {
    // Reaching back over a finished sprint means starting in the past, and that
    // is refused first — so a create answers 400 "may not start in the past",
    // not 409 "overlaps". The overlap-with-a-past-sprint case is only reachable
    // by EDITING a sprint backwards, where `isNew: false` lifts the date floor.
    const candidate = { start: day('2026-09-08'), end: day('2026-09-21') };
    expect(() => validateSprintDates(candidate, today, { isNew: true })).toThrow(
      SprintValidationError
    );
    expect(() => validateSprintDates(candidate, today, { isNew: false })).not.toThrow();
  });

  it('refuses a new sprint that swallows the running one whole', () => {
    const candidate = { start: day('2026-09-10'), end: day('2026-10-10') };
    expect(findOverlappingSprint(candidate, existing)).not.toBeNull();
  });

  it('refuses a new sprint that merely SHARES the running sprint’s end date', () => {
    const candidate = { start: day('2026-09-28'), end: day('2026-10-11') };
    expect(findOverlappingSprint(candidate, existing)).toBe(activeSprint);
  });

  it('allows a new sprint starting the day after the running one ends', () => {
    const candidate = { start: day('2026-09-29'), end: day('2026-10-12') };
    expect(findOverlappingSprint(candidate, existing)).toBeNull();
  });

  it('a DEFAULTED window never collides, even with both a running and a planned sprint', () => {
    // The one case that ties the two asks together: the default has to chain off
    // whichever sprint ends last, or the server refuses a date it chose itself.
    const upcoming = { _id: 'upcoming', start: day('2026-09-29'), end: day('2026-10-12') };
    const all = [pastSprint, activeSprint, upcoming];
    const window = defaultSprintWindow(latestEndingSprint(all), today);

    expect(findOverlappingSprint(window, all)).toBeNull();
    expect(() => validateSprintDates(window, today, { isNew: true })).not.toThrow();
  });
});

describe('partitionSprintCarry', () => {
  const carryTicket = (id, overrides = {}) => ({ _id: id, storyPoints: 1, ...overrides });

  it('carries unfinished work and leaves finished work behind', () => {
    const tickets = [
      carryTicket('a', { status: 'todo' }),
      carryTicket('b', { status: 'doing' }),
      carryTicket('c', { status: 'done' }),
    ];
    const { carry, stay } = partitionSprintCarry(tickets, DEFAULT_STATUSES);
    expect(carry).toEqual(['a', 'b']);
    expect(stay).toEqual(['c']);
  });

  it('carries a blocked ticket — it is the work that most needs to follow you', () => {
    const { carry } = partitionSprintCarry(
      [carryTicket('a', { status: 'blocked' })],
      DEFAULT_STATUSES
    );
    expect(carry).toEqual(['a']);
  });

  it('leaves an archived ticket behind even when it is unfinished', () => {
    const tickets = [
      carryTicket('a', { status: 'doing', isArchived: true }),
      carryTicket('b', { status: 'doing' }),
    ];
    const { carry, stay } = partitionSprintCarry(tickets, DEFAULT_STATUSES);
    expect(carry).toEqual(['b']);
    expect(stay).toEqual(['a']);
  });

  it('reads done off the status FLAG, so a renamed done column still stays', () => {
    const renamed = [
      { _id: 'todo', slug: 'to do', label: 'To do', sortOrder: 1 },
      { _id: 'shipped', slug: 'shipped', label: 'Shipped \u{1F680}', sortOrder: 2, isDone: true },
    ];
    const { carry, stay } = partitionSprintCarry(
      [carryTicket('a', { status: 'shipped' }), carryTicket('b', { status: 'todo' })],
      renamed
    );
    expect(stay).toEqual(['a']);
    expect(carry).toEqual(['b']);
  });

  it('carries everything, without throwing, in a workspace with no done status', () => {
    const noDone = [
      { _id: 'todo', slug: 'to do', label: 'To do', sortOrder: 1 },
      { _id: 'doing', slug: 'in progress', label: 'In progress', sortOrder: 2 },
    ];
    const { carry, stay } = partitionSprintCarry(
      [carryTicket('a', { status: 'todo' }), carryTicket('b', { status: 'doing' })],
      noDone
    );
    expect(carry).toEqual(['a', 'b']);
    expect(stay).toEqual([]);
  });

  it('is empty for no tickets and does not throw on junk', () => {
    expect(partitionSprintCarry([], DEFAULT_STATUSES)).toEqual({ carry: [], stay: [] });
    expect(partitionSprintCarry([null, undefined], DEFAULT_STATUSES)).toEqual({
      carry: [],
      stay: [],
    });
  });

  it('does not depend on story points — an unestimated ticket still carries', () => {
    const { carry } = partitionSprintCarry([{ _id: 'a', status: 'doing' }], DEFAULT_STATUSES);
    expect(carry).toEqual(['a']);
  });
});

describe('resolveRollover', () => {
  const finished = { _id: 'finished', start: day('2026-09-01'), end: day('2026-09-14') };
  // One day after `finished` ended.
  const today = day('2026-09-15');

  it('rolls over a finished sprint with nothing after it', () => {
    const due = resolveRollover([finished], today);
    expect(due.endedSprint).toBe(finished);
    expect(due.window.start).toEqual(day('2026-09-15'));
    expect(due.window.end).toEqual(day('2026-09-28'));
  });

  it('does nothing while a sprint is running', () => {
    const active = { _id: 'active', start: day('2026-09-15'), end: day('2026-09-28') };
    expect(resolveRollover([finished, active], today)).toBeNull();
  });

  it('does nothing when the team has already planned the next sprint', () => {
    // Silently pouring tickets nobody chose into a sprint somebody did plan is
    // worse than doing nothing; the leftovers tab stays the only way in.
    const upcoming = { _id: 'upcoming', start: day('2026-09-20'), end: day('2026-10-03') };
    expect(resolveRollover([finished, upcoming], today)).toBeNull();
  });

  it('does nothing in a workspace that has never run a sprint', () => {
    expect(resolveRollover([], today)).toBeNull();
    expect(resolveRollover([{ _id: 'junk' }], today)).toBeNull();
  });

  it('rolls over off the sprint that ended LAST when several have finished', () => {
    const older = { _id: 'older', start: day('2026-08-01'), end: day('2026-08-14') };
    expect(resolveRollover([older, finished], today).endedSprint).toBe(finished);
  });

  it('still rolls over at exactly one sprint length of silence', () => {
    expect(resolveRollover([finished], day('2026-09-28'))).not.toBeNull();
  });

  it('stops once the workspace has gone dormant', () => {
    // The guard that stops a workspace which ran one sprint in March growing a
    // fresh empty sprint every fortnight forever, off nothing but a page load.
    expect(resolveRollover([finished], day('2026-09-29'))).toBeNull();
    expect(resolveRollover([finished], day('2027-03-01'))).toBeNull();
  });

  it('measures dormancy in the workspace’s own cadence', () => {
    expect(resolveRollover([finished], day('2026-09-25'), { lengthDays: 7 })).toBeNull();
    expect(resolveRollover([finished], day('2026-09-25'), { lengthDays: 28 })).not.toBeNull();
  });

  it('does nothing when the workspace turned it off', () => {
    expect(resolveRollover([finished], today, { autoRollover: false })).toBeNull();
  });

  it('never proposes a window that its own create path would refuse', () => {
    const due = resolveRollover([finished], today);
    expect(() => validateSprintDates(due.window, today, { isNew: true })).not.toThrow();
    expect(findOverlappingSprint(due.window, [finished])).toBeNull();
  });

  it('starts the successor today rather than in the gap it is closing', () => {
    // A sprint backdated into the gap would arrive already part-consumed.
    const due = resolveRollover([finished], day('2026-09-20'));
    expect(due.window.start).toEqual(day('2026-09-20'));
  });
});
