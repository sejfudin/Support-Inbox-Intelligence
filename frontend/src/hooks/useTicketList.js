import { useState, useMemo } from "react";
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounceSearch] = useDebounce(search, 500);
  const limit = 10;

  const queryParams = getTicketsQueryParams({
    page,
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

  return {
    tickets: normalizedTickets,
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isError: query.isError,
    isPlaceholderData: query.isPlaceholderData,
    search,
    setSearch,
    page,
    setPage,
  };
}
