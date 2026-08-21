import { describe, expect, it } from 'vitest';
import { getBacklogStatusId, getDefaultMainStatusId } from './ticketStatus';

// These two are easy to confuse — a ticket created with the wrong one silently
// lands on the wrong page (see NewTickets.jsx / Backlog.jsx): passing
// defaultMainStatusId as the Backlog page's fallback status sent new tickets
// straight to Tickets/Board instead of keeping them in Backlog.
const STATUSES = [
  { _id: 'backlog-id', slug: 'backlog', isBacklog: true },
  { _id: 'todo-id', slug: 'to-do', isBacklog: false },
  { _id: 'progress-id', slug: 'in-progress', isBacklog: false },
];

describe('getBacklogStatusId', () => {
  it('returns the id of the status flagged isBacklog', () => {
    expect(getBacklogStatusId(STATUSES)).toBe('backlog-id');
  });

  it('is empty when no status is flagged isBacklog', () => {
    expect(getBacklogStatusId(STATUSES.filter((s) => !s.isBacklog))).toBe('');
  });

  it('is empty for an empty list', () => {
    expect(getBacklogStatusId([])).toBe('');
  });
});

describe('getDefaultMainStatusId', () => {
  it('returns the first non-backlog status, never the backlog one', () => {
    expect(getDefaultMainStatusId(STATUSES)).toBe('todo-id');
  });

  it('never returns a backlog status id, even if it sorts first', () => {
    const backlogFirst = [STATUSES[0], STATUSES[1], STATUSES[2]];
    expect(getDefaultMainStatusId(backlogFirst)).not.toBe('backlog-id');
  });
});
