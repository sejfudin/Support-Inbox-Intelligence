import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "use-debounce";
import { useTickets } from "@/queries/tickets";
import { normalizeTicket } from "@/helpers/normalizeTicket";
import { getTicketsQueryParams } from "@/helpers/ticketsQuery";

export function useTicketList({
  activeTab,
  additionalFilters = {},
  queryFilters = {},
  enabled = true,
}) {
  const [requestedPage, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounceSearch] = useDebounce(search, 500);
  const limit = 10;

  const queryParams = getTicketsQueryParams({
    page: requestedPage,
    search: debounceSearch,
    activeTab,
    listLimit: limit,
    queryFilters,
    ...additionalFilters,
  });

  const query = useTickets(queryParams.list, { enabled });

  const normalizedTickets = useMemo(
    () => (query.data?.data || []).map(normalizeTicket),
    [query.data?.data],
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
  };
}
