import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllTickets, createTicket } from "@/api/tickets";

export const useTickets = (params) => {
  return useQuery({
    queryKey: ["tickets", params],
    queryFn: () => getAllTickets(params),
    placeholderData: (previousData) => previousData,
  });
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
};
