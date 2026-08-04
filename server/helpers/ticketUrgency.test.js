const { scoreTicketUrgency, compareByUrgency } = require('./ticketUrgency');

// A fixed "today" keeps every case deterministic — the helper takes the day key
// as an argument precisely so the suite never depends on the real clock.
const TODAY = '2026-07-20';

const score = (ticket) => scoreTicketUrgency(ticket, TODAY).score;
const flags = (ticket) => scoreTicketUrgency(ticket, TODAY).flags;

// The shape the comparator sorts, built from the scorer so the two can't drift.
const ticket = (name, attrs) => ({
  name,
  taskNumber: attrs.taskNumber ?? null,
  dueDateKey: attrs.dueDateKey ?? null,
  ...scoreTicketUrgency(attrs, TODAY),
});

const order = (...tickets) => [...tickets].sort(compareByUrgency).map((t) => t.name);

describe('scoreTicketUrgency', () => {
  it('flags a past due date as overdue', () => {
    expect(flags({ priority: 'medium', dueDateKey: '2026-07-19' })).toContain('overdue');
    expect(
      scoreTicketUrgency({ priority: 'medium', dueDateKey: '2026-07-19' }, TODAY).overdue
    ).toBe(true);
  });

  it('does not treat a ticket due today as overdue', () => {
    const result = scoreTicketUrgency({ priority: 'medium', dueDateKey: TODAY }, TODAY);

    expect(result.overdue).toBe(false);
    expect(result.flags).toContain('due-soon');
  });

  it('ranks overdue above every other combination', () => {
    const overdue = score({ priority: 'low', dueDateKey: '2026-07-19' });
    const worstNonOverdue = score({ priority: 'critical', dueDateKey: TODAY, isBlocked: true });

    expect(overdue).toBeGreaterThan(worstNonOverdue);
  });

  it('separates priorities within the same blocked state', () => {
    const blockedCritical = score({ priority: 'critical', isBlocked: true });
    const blockedLow = score({ priority: 'low', isBlocked: true });

    expect(blockedCritical).toBeGreaterThan(blockedLow);
  });

  it('nudges the ordering for a deadline this week without flagging it', () => {
    const thisWeek = scoreTicketUrgency({ priority: 'low', dueDateKey: '2026-07-25' }, TODAY);
    const noDate = scoreTicketUrgency({ priority: 'low' }, TODAY);

    expect(thisWeek.score).toBeGreaterThan(noDate.score);
    expect(thisWeek.flags).toEqual([]);
  });

  it('ignores a deadline further out than a week', () => {
    expect(score({ priority: 'low', dueDateKey: '2026-08-30' })).toBe(score({ priority: 'low' }));
  });

  it('chips only what a person would call out', () => {
    expect(flags({ priority: 'critical', dueDateKey: '2026-07-19', isBlocked: true })).toEqual([
      'overdue',
      'blocked',
      'critical',
    ]);
    expect(flags({ priority: 'medium' })).toEqual([]);
  });
});

describe('compareByUrgency', () => {
  it('puts the most urgent ticket first', () => {
    const overdue = ticket('overdue', { priority: 'low', dueDateKey: '2026-07-18' });
    const blocked = ticket('blocked', { priority: 'high', isBlocked: true });
    const quiet = ticket('quiet', { priority: 'medium' });

    expect(order(quiet, blocked, overdue)).toEqual(['overdue', 'blocked', 'quiet']);
  });

  it('breaks a tie on the nearer deadline', () => {
    const soon = ticket('soon', { priority: 'high', dueDateKey: '2026-07-21' });
    const later = ticket('later', { priority: 'high', dueDateKey: '2026-07-22' });

    expect(soon.score).toBe(later.score);
    expect(order(later, soon)).toEqual(['soon', 'later']);
  });

  it('sorts dateless tickets after dated ones of equal urgency', () => {
    const dated = ticket('dated', { priority: 'low', dueDateKey: '2026-08-30' });
    const dateless = ticket('dateless', { priority: 'low' });

    expect(dated.score).toBe(dateless.score);
    expect(order(dateless, dated)).toEqual(['dated', 'dateless']);
  });

  it('falls back to the oldest ticket number so the order is stable', () => {
    const older = ticket('older', { priority: 'medium', taskNumber: 3 });
    const newer = ticket('newer', { priority: 'medium', taskNumber: 91 });

    expect(order(newer, older)).toEqual(['older', 'newer']);
  });
});
