import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllTickets,
  getTicket,
  addMessage,
  createTicket,
  archiveTicket,
  unarchiveTicket,
  updateTicket,
  getMyTickets,
  suggestTicketMetadata,
  generateTicketDescription,
  getTicketDescriptionImages,
  uploadTicketDescriptionImages,
  deleteTicketDescriptionImage,
} from '@/api/tickets';
import { invalidateAnalyticsQueries } from '@/lib/analyticsQueryCache';
import { invalidateTicketScope, invalidateWorkspaceTicketsScope } from '@/lib/invalidationScopes';
import { BOARD_COLUMN_QUERY_KEY } from '@/queries/boardTickets';

export const useTickets = (params, options = {}) => {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: () => getAllTickets(params),
    placeholderData: (previousData) => previousData,
    ...options,
  });
};

export const useTicket = (id) => {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id),
    enabled: !!id,
  });
};

export const useAddMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addMessage,
    onSuccess: (_, variables) => {
      invalidateTicketScope(queryClient, variables.ticketId);
    },
  });
};
export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: (ticket) => {
      const workspaceId = ticket?.workspace?._id ?? ticket?.workspace ?? ticket?.workspaceId;
      invalidateWorkspaceTicketsScope(queryClient, workspaceId);
      queryClient.invalidateQueries({ queryKey: [BOARD_COLUMN_QUERY_KEY] });
      invalidateAnalyticsQueries(queryClient, workspaceId);
    },
  });
};

export const useUpdateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars) => updateTicket(vars.ticketId, vars.updates),
    onSuccess: (ticket, variables) => {
      const workspaceId =
        variables.workspaceId ?? ticket?.workspace?._id ?? ticket?.workspace ?? ticket?.workspaceId;
      invalidateTicketScope(queryClient, variables.ticketId);
      invalidateWorkspaceTicketsScope(queryClient, workspaceId);
      queryClient.invalidateQueries({ queryKey: [BOARD_COLUMN_QUERY_KEY] });
      invalidateAnalyticsQueries(queryClient, workspaceId);
    },
  });
};

export const useArchiveTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveTicket,
    onSuccess: (ticket, ticketId) => {
      const workspaceId = ticket?.workspace?._id ?? ticket?.workspace ?? ticket?.workspaceId;
      invalidateTicketScope(queryClient, ticketId);
      invalidateWorkspaceTicketsScope(queryClient, workspaceId);
    },
  });
};

export const useUnarchiveTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unarchiveTicket,
    onSuccess: (ticket, ticketId) => {
      const workspaceId = ticket?.workspace?._id ?? ticket?.workspace ?? ticket?.workspaceId;
      invalidateTicketScope(queryClient, ticketId);
      invalidateWorkspaceTicketsScope(queryClient, workspaceId);
    },
  });
};

export const useMyTickets = (params, options = {}) => {
  return useQuery({
    queryKey: ['tickets', 'workspace', params],
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

export const useGenerateTicketDescription = () => {
  return useMutation({
    mutationFn: generateTicketDescription,
  });
};

// supabase

export const useTicketDescriptionImages = (ticketId) => {
  return useQuery({
    queryKey: ['ticket-description-images', ticketId],
    queryFn: () => getTicketDescriptionImages(ticketId),
    enabled: !!ticketId,
  });
};

export const useUploadTicketDescriptionImages = (ticketId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files) => uploadTicketDescriptionImages(ticketId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-description-images', ticketId] });
    },
  });
};

export const useDeleteTicketDescriptionImage = (ticketId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId) => deleteTicketDescriptionImage(ticketId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-description-images', ticketId] });
    },
  });
};
