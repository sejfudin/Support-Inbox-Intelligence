import { useInfiniteQuery } from '@tanstack/react-query';
import { getAllTickets, getMyTickets } from '@/api/tickets';
import {
  BOARD_COLUMN_PAGE_SIZE,
  buildBoardColumnQueryParams,
  serializeBoardQueryFilters,
} from '@/helpers/boardTicketsQuery';

export const BOARD_COLUMN_QUERY_KEY = 'board-column';

export function useBoardColumnTickets({
  columnStatusId,
  fetchMode = 'all',
  workspaceId,
  search = '',
  queryFilters = {},
  enabled = true,
  pageSize = BOARD_COLUMN_PAGE_SIZE,
}) {
  const filterKey = serializeBoardQueryFilters(queryFilters);

  return useInfiniteQuery({
    queryKey: [
      BOARD_COLUMN_QUERY_KEY,
      fetchMode,
      columnStatusId,
      workspaceId,
      search,
      filterKey,
      pageSize,
    ],
    queryFn: ({ pageParam = 1 }) => {
      const params = buildBoardColumnQueryParams({
        columnStatusId,
        search,
        workspaceId,
        queryFilters,
        page: pageParam,
        limit: pageSize,
      });

      return fetchMode === 'my' ? getMyTickets(params) : getAllTickets(params);
    },
    initialPageParam: 1,
    staleTime: 0,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage?.pagination;
      if (!pagination) return undefined;
      return pagination.page < pagination.pages ? pagination.page + 1 : undefined;
    },
    enabled: enabled && !!columnStatusId && (fetchMode === 'my' || !!workspaceId),
  });
}
