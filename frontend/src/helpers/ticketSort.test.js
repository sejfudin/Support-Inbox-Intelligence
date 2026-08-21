import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_DEFAULT_SORT,
  BACKLOG_DEFAULT_SORT,
  buildTicketSortParams,
  isSortableTicketColumn,
  normalizeTicketSorting,
} from './ticketSort';

describe('isSortableTicketColumn', () => {
  it('accepts the columns the API can order', () => {
    expect(isSortableTicketColumn('archivedAt')).toBe(true);
    expect(isSortableTicketColumn('title')).toBe(true);
    expect(isSortableTicketColumn('priority')).toBe(true);
  });

  it('rejects columns the API cannot order', () => {
    expect(isSortableTicketColumn('assignedTo')).toBe(false);
    expect(isSortableTicketColumn('totalTimeSpent')).toBe(false);
    expect(isSortableTicketColumn(undefined)).toBe(false);
  });
});

describe('normalizeTicketSorting', () => {
  it('keeps a single sortable column', () => {
    expect(normalizeTicketSorting([{ id: 'storyPoints', desc: false }])).toEqual([
      { id: 'storyPoints', desc: false },
    ]);
  });

  it('drops everything past the first sortable column', () => {
    expect(
      normalizeTicketSorting([
        { id: 'taskNumber', desc: true },
        { id: 'title', desc: false },
      ])
    ).toEqual([{ id: 'taskNumber', desc: true }]);
  });

  it('skips a column the API cannot order', () => {
    expect(
      normalizeTicketSorting([
        { id: 'assignedTo', desc: true },
        { id: 'dueDate', desc: true },
      ])
    ).toEqual([{ id: 'dueDate', desc: true }]);
  });

  it('falls back to the page default when the sort is cleared', () => {
    expect(normalizeTicketSorting([], ARCHIVE_DEFAULT_SORT)).toEqual([
      { id: 'archivedAt', desc: true },
    ]);
    expect(normalizeTicketSorting(undefined, BACKLOG_DEFAULT_SORT)).toEqual([
      { id: 'createdAt', desc: true },
    ]);
  });

  it('returns nothing when there is no default either', () => {
    expect(normalizeTicketSorting([{ id: 'assignedTo', desc: true }])).toEqual([]);
  });
});

describe('buildTicketSortParams', () => {
  it('maps the subject column onto the API field name', () => {
    expect(buildTicketSortParams([{ id: 'title', desc: false }])).toEqual({
      sortBy: 'subject',
      sortOrder: 'asc',
    });
  });

  it('sends the archive default as newest archived first', () => {
    expect(buildTicketSortParams(ARCHIVE_DEFAULT_SORT)).toEqual({
      sortBy: 'archivedAt',
      sortOrder: 'desc',
    });
  });

  it('routes priority through priorityOrder instead of sortBy', () => {
    expect(buildTicketSortParams([{ id: 'priority', desc: true }])).toEqual({
      priorityOrder: 'desc',
    });
  });

  it('returns no parameters when nothing is sorted', () => {
    expect(buildTicketSortParams([])).toEqual({});
  });
});
