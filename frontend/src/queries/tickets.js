import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllTickets,
  getTicket,
  addMessage,
  createTicket,
  archiveTicket,
  updateTicket,
  getMyTickets, 
  suggestTicketMetadata
} from "@/api/tickets";

const invalidateWorkspaceAnalytics = (queryClient) => {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "workspaces" &&
      query.queryKey.includes("analytics"),
  });
};

const invalidateUserAnalytics = (queryClient) => {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "workspaces" &&
      query.queryKey.includes("user-analytics"),
  });
};

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
      invalidateWorkspaceAnalytics(queryClient);
      invalidateUserAnalytics(queryClient);
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
      invalidateWorkspaceAnalytics(queryClient);
      invalidateUserAnalytics(queryClient);
    },
  });
};

export const useArchiveTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveTicket,
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      invalidateWorkspaceAnalytics(queryClient);
      invalidateUserAnalytics(queryClient);
    },
  });
};

export const useMyTickets = (params, options = {}) => {
  return useQuery({
    queryKey: ["tickets", "workspace", params],
    queryFn: () => getMyTickets(params),
    placeholderData: (previousData) => previousData,
    ...options,
  });
};

export const useSuggestTicketMetadata = () => {
  return useMutation({
    mutationFn: suggestTicketMetadata,
  });
};
