import { getTicketsQueryParams } from '@/helpers/ticketsQuery';

export const BOARD_COLUMN_PAGE_SIZE = 20;

const PRIORITY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const serializeBoardQueryFilters = (queryFilters = {}) =>
  JSON.stringify({
    priorities: queryFilters.priorities ?? '',
    assigneeIds: queryFilters.assigneeIds ?? '',
    priorityOrder: queryFilters.priorityOrder ?? '',
    sortBy: queryFilters.sortBy ?? '',
    sortOrder: queryFilters.sortOrder ?? '',
  });

/** Keep board column requests aligned with list view sorting/filter params. */
export const buildBoardColumnQueryParams = ({
  columnStatusId,
  search = '',
  workspaceId,
  queryFilters = {},
  page = 1,
  limit = BOARD_COLUMN_PAGE_SIZE,
}) => {
  const { list } = getTicketsQueryParams({
    page,
    search,
    activeTab: 'all',
    archived: false,
    status: '',
    workspaceId,
    queryFilters,
    listLimit: limit,
  });

  const { status: _status, ...rest } = list;

  return {
    ...rest,
    statusId: columnStatusId,
  };
};

export const sortBoardTasksByPriorityOrder = (tasks, priorityOrder) => {
  if (priorityOrder !== 'asc' && priorityOrder !== 'desc') {
    return tasks;
  }

  const direction = priorityOrder === 'desc' ? -1 : 1;

  return [...tasks].sort((a, b) => {
    const rankA = PRIORITY_RANK[String(a.priority || '').toLowerCase()] ?? PRIORITY_RANK.medium;
    const rankB = PRIORITY_RANK[String(b.priority || '').toLowerCase()] ?? PRIORITY_RANK.medium;

    if (rankA !== rankB) {
      return (rankA - rankB) * direction;
    }

    const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return updatedB - updatedA;
  });
};
