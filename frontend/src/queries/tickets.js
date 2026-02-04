import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllTickets, getTicket, addMessage } from "@/api/tickets";

export const useTickets = (params) => {
  return useQuery({
    queryKey: ["tickets", params],
    queryFn: () => getAllTickets(params),
    keepPreviousData: true, 
  });
};

export const useTicket = (id) => {
  return useQuery({
    queryKey: ["ticket", id],
    queryFn: () => getTicket(id),
    enabled: !!id,
  });
};

export const useAddMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addMessage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["ticket", variables.ticketId]);
    },
  });
};