import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllTickets,
  getTicket,
  addMessage,
  createTicket,
  archiveTicket,
  unarchiveTicket,
  updateTicket,
  setSprintMembership,
  bulkUpdateTicketStatus,
  bulkArchiveTickets,
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
import { toast } from 'sonner';
import { invalidateAnalyticsQueries } from '@/lib/analyticsQueryCache';
import { applyOptimisticBoardMove, rollbackOptimisticBoardMove } from '@/lib/boardOptimisticMove';
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

/**
 * A board drag: the same `PATCH /tickets/:id` as `useUpdateTicket`, but optimistic.
 *
 * Separate from `useUpdateTicket` on purpose — that hook is shared by the details
 * modal and every other ticket edit, none of which move a card between columns, so
 * none of them want this cache surgery.
 *
 * `statusDoc` is the destination status as a populated object, from
 * `helpers.resolveStatusDocFromColumnId(columnId)`. Passing the id alone would put
 * the card in the first column instead of the one it was dropped in.
 */
export const useBoardStatusMove = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, statusId }) => updateTicket(ticketId, { statusId }),
    onMutate: async ({ ticketId, statusId, statusDoc }) => {
      // Board columns run at `staleTime: 0`, so a refetch is very often already in
      // flight when a card is dropped. Cancelling first is what stops that response
      // from landing after the optimistic write and putting the card back.
      await queryClient.cancelQueries({ queryKey: [BOARD_COLUMN_QUERY_KEY] });

      return {
        snapshot: applyOptimisticBoardMove(queryClient, {
          ticketId,
          destinationStatusId: statusId,
          destinationStatusDoc: statusDoc,
        }),
      };
    },
    onError: (_error, _variables, context) => {
      rollbackOptimisticBoardMove(queryClient, context?.snapshot);
      toast.error('Could not move ticket. Please try again.');
    },
    // On `onSettled` rather than `onSuccess`, so a failed move also reconciles
    // against the server once the card has snapped back — the rollback restores
    // what the client believed, not what the server holds.
    onSettled: (ticket, _error, variables) => {
      const workspaceId =
        variables.workspaceId ?? ticket?.workspace?._id ?? ticket?.workspace ?? ticket?.workspaceId;
      invalidateTicketScope(queryClient, variables.ticketId);
      invalidateWorkspaceTicketsScope(queryClient, workspaceId);
      queryClient.invalidateQueries({ queryKey: [BOARD_COLUMN_QUERY_KEY] });
      invalidateAnalyticsQueries(queryClient, workspaceId);
    },
  });
};

export const useSetSprintMembership = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setSprintMembership,
    onSuccess: (_, variables) => {
      invalidateWorkspaceTicketsScope(queryClient, variables.workspaceId);
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

/**
 * A board column's selection, moved to another status or archived in one request.
 *
 * Not optimistic, unlike a drag (`useBoardStatusMove`): a drag moves one card the
 * person is holding, where the card snapping back IS the error message. A batch
 * moves cards across two columns at once, and rolling that back convincingly
 * costs more than the refetch it would save.
 */
export const useBulkTicketStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkUpdateTicketStatus,
    onSuccess: (_response, variables) => {
      invalidateWorkspaceTicketsScope(queryClient, variables.workspaceId);
      queryClient.invalidateQueries({ queryKey: [BOARD_COLUMN_QUERY_KEY] });
      invalidateAnalyticsQueries(queryClient, variables.workspaceId);
    },
  });
};

export const useBulkArchiveTickets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkArchiveTickets,
    onSuccess: (_response, variables) => {
      invalidateWorkspaceTicketsScope(queryClient, variables.workspaceId);
      queryClient.invalidateQueries({ queryKey: [BOARD_COLUMN_QUERY_KEY] });
      invalidateAnalyticsQueries(queryClient, variables.workspaceId);
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
    mutationFn: ({ ticketId, state }) => answerReview(ticketId, { state }),
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
