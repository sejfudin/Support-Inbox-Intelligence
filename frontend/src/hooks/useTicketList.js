import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import { useAuth } from '@/context/AuthContext';
import { useTickets } from '@/queries/tickets';
import { normalizeTicket } from '@/helpers/normalizeTicket';
import { getTicketsQueryParams } from '@/helpers/ticketsQuery';
import { buildTicketSortParams, normalizeTicketSorting } from '@/helpers/ticketSort';

/**
 * `defaultSort` opts a list into column sorting. It is a TanStack sorting state
 * (`[{ id, desc }]`) that this hook owns and turns into API parameters — the list
 * is paginated, so the sort has to reach the server to be true past page one.
 * Lists that pass nothing keep their previous behaviour.
 */
export function useTicketList({
  activeTab,
  additionalFilters = {},
  queryFilters = {},
  enabled = true,
  defaultSort = null,
}) {
  const { user } = useAuth();
  const [requestedPage, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounceSearch] = useDebounce(search, 500);

  // The default is captured once: pages pass an array literal, so reading it on
  // every render would make the fallback a new object each time.
  const fallbackSortRef = useRef(null);
  if (fallbackSortRef.current === null) {
    fallbackSortRef.current = normalizeTicketSorting(defaultSort);
  }

  const [sorting, setSortingState] = useState(fallbackSortRef.current);

  // A new order restarts the list: page 4 of "oldest first" is not page 4 of
  // "newest first", and the rows there would look arbitrary.
  const setSorting = useCallback((next) => {
    setSortingState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      return normalizeTicketSorting(resolved, fallbackSortRef.current);
    });
    setPage(1);
  }, []);
  // Rows per page on every ticket list surface — Tickets, Archive and Backlog all
  // run through this hook. The board is unaffected: it pages through
  // `getTicketsQueryParams`'s separate `boardLimit`, which fetches every card at once.
  const limit = 25;

  const activeWorkspaceId = additionalFilters.workspaceId ?? user?.workspaceId;

  const queryParams = getTicketsQueryParams({
    page: requestedPage,
    search: debounceSearch,
    activeTab,
    listLimit: limit,
    queryFilters: { ...queryFilters, ...buildTicketSortParams(sorting) },
    workspaceId: activeWorkspaceId,
    ...additionalFilters,
  });

  const query = useTickets(queryParams.list, { enabled });

  const normalizedTickets = useMemo(
    () => (query.data?.data || []).map(normalizeTicket),
    [query.data?.data]
  );

  const pagination = query.data?.pagination;

  const actualPage = pagination?.page || requestedPage;
  const totalPages = pagination?.pages || 1;

  const page = actualPage > totalPages && totalPages > 0 ? totalPages : actualPage;

  useEffect(() => {
    if (pagination && pagination.page > pagination.pages && pagination.pages > 0) {
      setPage(pagination.pages);
    }
  }, [pagination]);

  return {
    tickets: normalizedTickets,
    pagination,
    isLoading: query.isLoading,
    isError: query.isError,
    isPlaceholderData: query.isPlaceholderData,
    search,
    setSearch,
    page,
    setPage,
    sorting,
    setSorting,
  };
}
