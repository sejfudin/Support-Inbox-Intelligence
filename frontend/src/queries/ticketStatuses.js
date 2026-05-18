import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTicketStatuses,
  createTicketStatus,
  updateTicketStatus,
  deleteTicketStatus,
  reorderTicketStatuses,
} from '@/api/ticketStatuses';
import { invalidateWorkspaceScope } from '@/lib/invalidationScopes';

export const TICKET_STATUSES_QUERY_KEY = 'ticket-statuses';

export const ticketStatusKeys = {
  byWorkspace: (workspaceId) => [TICKET_STATUSES_QUERY_KEY, workspaceId],
};

const invalidateAfterStatusChange = (queryClient, workspaceId) => {
  invalidateWorkspaceScope(queryClient, workspaceId);
};

export const useTicketStatusesQuery = (workspaceId, options = {}) =>
  useQuery({
    queryKey: ticketStatusKeys.byWorkspace(workspaceId),
    queryFn: async () => {
      const result = await getTicketStatuses(workspaceId);
      return result.data ?? [];
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });

export const useCreateTicketStatus = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTicketStatus,
    onSuccess: () => {
      invalidateAfterStatusChange(queryClient, workspaceId);
    },
  });
};

export const useUpdateTicketStatus = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => updateTicketStatus(id, data, workspaceId),
    onSuccess: () => {
      invalidateAfterStatusChange(queryClient, workspaceId);
    },
  });
};

export const useDeleteTicketStatus = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => {
      const id = typeof input === 'string' ? input : input.id;
      const reassignToStatusId = typeof input === 'object' ? input.reassignToStatusId : undefined;
      return deleteTicketStatus(id, workspaceId, { reassignToStatusId });
    },
    onSuccess: () => {
      invalidateAfterStatusChange(queryClient, workspaceId);
    },
  });
};

export const useReorderTicketStatuses = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderTicketStatuses,
    onSuccess: () => {
      invalidateAfterStatusChange(queryClient, workspaceId);
    },
  });
};
