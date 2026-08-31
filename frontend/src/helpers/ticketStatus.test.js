import { describe, expect, it } from 'vitest';
import {
  buildTicketStatusHelpers,
  getBacklogStatusId,
  getDefaultMainStatusId,
} from './ticketStatus';

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

// A full status list, since these helpers read fields the two above ignore.
const WORKSPACE_STATUSES = [
  {
    _id: '507f1f77bcf86cd799439011',
    slug: 'backlog',
    label: 'Backlog',
    color: '#6b7280',
    isBacklog: true,
    tracksTime: false,
    isDone: false,
    sortOrder: 0,
  },
  {
    _id: '507f1f77bcf86cd799439012',
    slug: 'to-do',
    label: 'To do',
    color: '#64748b',
    isBacklog: false,
    tracksTime: false,
    isDone: false,
    sortOrder: 1,
  },
  {
    _id: '507f1f77bcf86cd799439013',
    slug: 'in-progress',
    label: 'In progress',
    color: '#3b82f6',
    isBacklog: false,
    tracksTime: true,
    isDone: false,
    sortOrder: 2,
  },
];

describe('resolveStatusDocFromColumnId', () => {
  const helpers = buildTicketStatusHelpers(WORKSPACE_STATUSES);

  it('returns a populated status object, not a bare id', () => {
    expect(helpers.resolveStatusDocFromColumnId('507f1f77bcf86cd799439013')).toEqual({
      _id: '507f1f77bcf86cd799439013',
      slug: 'in-progress',
      label: 'In progress',
      color: '#3b82f6',
      isBacklog: false,
      tracksTime: true,
      isDone: false,
    });
  });

  it('resolves back to the same column it was built from', () => {
    // The reason this helper exists. An optimistic board move writes the doc onto
    // the ticket, and `resolveBoardColumnId` then has to put the card in the column
    // it was dropped in. A bare ObjectId string fails this round trip — it reads as
    // an empty slug and falls through to the first column.
    WORKSPACE_STATUSES.filter((s) => !s.isBacklog).forEach((status) => {
      const columnId = String(status._id);
      const doc = helpers.resolveStatusDocFromColumnId(columnId);
      expect(helpers.resolveBoardColumnId(doc)).toBe(columnId);
    });
  });

  it('covers backlog statuses too, which are not board columns', () => {
    expect(helpers.resolveStatusDocFromColumnId('507f1f77bcf86cd799439011')?.slug).toBe('backlog');
  });

  it('is null for a column id the workspace does not have', () => {
    expect(helpers.resolveStatusDocFromColumnId('507f1f77bcf86cd799439099')).toBeNull();
    expect(helpers.resolveStatusDocFromColumnId(undefined)).toBeNull();
  });
});
