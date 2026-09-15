import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteTicketDraft, getTicketDraft, saveTicketDraft } from '@/api/ticketDrafts';

export const TICKET_DRAFT_QUERY_KEY = 'ticket-draft';

export const ticketDraftQueryKey = (workspaceId) => [TICKET_DRAFT_QUERY_KEY, workspaceId ?? null];

/**
 * The draft waiting in this workspace, or `null`.
 *
 * `staleTime: 0` with no refetch on focus: the modal reads this exactly once per
 * opening (see `useTicketDraftAutosave`), and a refetch while someone is typing
 * would be a copy of the form racing the form itself.
 */
export const useTicketDraft = (workspaceId, { enabled = true } = {}) =>
  useQuery({
    queryKey: ticketDraftQueryKey(workspaceId),
    queryFn: async () => (await getTicketDraft(workspaceId))?.data ?? null,
    enabled: enabled && !!workspaceId,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });

// Both mutations write the cache straight from the response rather than
// invalidating it: an invalidation would refetch the draft into a modal that is
// still being typed in, which is the one thing this cache must not do.
export const useSaveTicketDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveTicketDraft,
    onSuccess: (response, variables) => {
      queryClient.setQueryData(ticketDraftQueryKey(variables.workspaceId), response?.data ?? null);
    },
  });
};

export const useDeleteTicketDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTicketDraft,
    onSuccess: (_response, workspaceId) => {
      queryClient.setQueryData(ticketDraftQueryKey(workspaceId), null);
    },
  });
};
