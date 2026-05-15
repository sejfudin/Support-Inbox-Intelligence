import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTicketStatuses,
  createTicketStatus,
  updateTicketStatus,
  deleteTicketStatus,
  reorderTicketStatuses,
} from '@/api/ticketStatuses';

export const TICKET_STATUSES_QUERY_KEY = 'ticket-statuses';

export const ticketStatusKeys = {
  byWorkspace: (workspaceId) => [TICKET_STATUSES_QUERY_KEY, workspaceId],
};

export const useTicketStatusesQuery = (workspaceId, options = {}) => {
  return useQuery({
    queryKey: ticketStatusKeys.byWorkspace(workspaceId),
    queryFn: async () => {
      const result = await getTicketStatuses(workspaceId);
      return result.data ?? [];
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useCreateTicketStatus = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTicketStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketStatusKeys.byWorkspace(workspaceId) });
    },
  });
};

export const useUpdateTicketStatus = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => updateTicketStatus(id, data, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketStatusKeys.byWorkspace(workspaceId) });
    },
  });
};

export const useDeleteTicketStatus = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteTicketStatus(id, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketStatusKeys.byWorkspace(workspaceId) });
    },
  });
};

export const useReorderTicketStatuses = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderTicketStatuses,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketStatusKeys.byWorkspace(workspaceId) });
    },
  });
};
