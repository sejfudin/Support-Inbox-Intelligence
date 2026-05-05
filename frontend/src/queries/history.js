import { useQuery } from "@tanstack/react-query";
import { getTicketHistory } from "@/api/history";

export const TICKET_HISTORY_QUERY_KEY = ["ticket-history"];

export function useTicketHistory(ticketId) {
  return useQuery({
    queryKey: [...TICKET_HISTORY_QUERY_KEY, ticketId],
    queryFn: () => getTicketHistory(ticketId),
    enabled: !!ticketId,
  });
}
