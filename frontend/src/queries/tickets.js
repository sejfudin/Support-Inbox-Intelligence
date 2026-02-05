import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllTickets,
  getTicket,
  addMessage,
  createTicket,
  updateTicket, 
} from "@/api/tickets";

export const useTickets = (params, options = {}) => {
  return useQuery({
    queryKey: ["tickets", params],
    queryFn: () => getAllTickets(params),
    placeholderData: (previousData) => previousData,
    ...options,
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
export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
};

export const useUpdateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars) => updateTicket(vars.ticketId, vars.updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ticket", variables.ticketId] });
      
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
};