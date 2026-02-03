import { useQuery } from "@tanstack/react-query";
import { getAllTickets } from "@/api/tickets";

export const useTickets= (params) => {
  return useQuery({
    queryKey: ["tickets", params],
    queryFn: () => getAllTickets(params),
    keepPreviousData: true, 
  });
};