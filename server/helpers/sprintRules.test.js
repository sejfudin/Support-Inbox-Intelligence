const {
  SPRINT_STATES,
  SPRINT_ESTIMATE_REQUIRED,
  SprintValidationError,
  deriveSprintState,
  pickSprintToShow,
  validateSprintDates,
  sprintsOverlap,
  findOverlappingSprint,
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
