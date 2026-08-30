import { describe, expect, it } from 'vitest';

import { buildBoardColumnQueryParams, serializeBoardQueryFilters } from './boardTicketsQuery';

describe('serializeBoardQueryFilters', () => {
  it('gives two sprints two different keys', () => {
    const a = serializeBoardQueryFilters({ sprintId: 'sprint-a' });
    const b = serializeBoardQueryFilters({ sprintId: 'sprint-b' });

    expect(a).not.toBe(b);
  });

  it('separates a sprint board from the unfiltered board', () => {
    expect(serializeBoardQueryFilters({ sprintId: 'sprint-a' })).not.toBe(
      serializeBoardQueryFilters({})
    );
  });

  it('gives the same filters the same key', () => {
    expect(serializeBoardQueryFilters({ sprintId: 'sprint-a', priorities: 'high' })).toBe(
      serializeBoardQueryFilters({ sprintId: 'sprint-a', priorities: 'high' })
    );
  });
});

describe('buildBoardColumnQueryParams', () => {
  it('sends the sprint filter to the ticket list', () => {
    const params = buildBoardColumnQueryParams({
      columnStatusId: 'status-1',
      workspaceId: 'workspace-1',
      queryFilters: { sprintId: 'sprint-a' },
    });

    expect(params.sprintId).toBe('sprint-a');
    expect(params.statusId).toBe('status-1');
  });

  it('leaves archived tickets out of the board', () => {
    const params = buildBoardColumnQueryParams({
      columnStatusId: 'status-1',
      workspaceId: 'workspace-1',
      queryFilters: { sprintId: 'sprint-a' },
    });

    expect(params.archived).toBe(false);
  });
});
