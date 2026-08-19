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
  getReviewerCandidates,
  requestReview,
  answerReview,
  cancelReview,
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

export const useReviewerCandidates = (ticketId, options = {}) => {
  return useQuery({
    queryKey: ['ticket', ticketId, 'review-request', 'candidates'],
    queryFn: () => getReviewerCandidates(ticketId),
    enabled: !!ticketId,
    ...options,
  });
};

// Shared by all three review-request mutations below: same scopes invalidate
// on request, answer and cancel, since each replaces the same ticket field.
const invalidateReviewRequestScopes = (queryClient, response, ticketId) => {
  const workspaceId =
    response?.data?.workspace?._id ?? response?.data?.workspace ?? response?.data?.workspaceId;
  invalidateTicketScope(queryClient, ticketId);
  invalidateWorkspaceTicketsScope(queryClient, workspaceId);
  queryClient.invalidateQueries({ queryKey: [BOARD_COLUMN_QUERY_KEY] });
};

export const useRequestReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, prUrl, reviewerId }) => requestReview(ticketId, { prUrl, reviewerId }),
    onSuccess: (response, variables) =>
      invalidateReviewRequestScopes(queryClient, response, variables.ticketId),
  });
};

export const useAnswerReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, decision }) => answerReview(ticketId, { decision }),
    onSuccess: (response, variables) =>
      invalidateReviewRequestScopes(queryClient, response, variables.ticketId),
  });
};

export const useCancelReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId) => cancelReview(ticketId),
    onSuccess: (response, ticketId) =>
      invalidateReviewRequestScopes(queryClient, response, ticketId),
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
