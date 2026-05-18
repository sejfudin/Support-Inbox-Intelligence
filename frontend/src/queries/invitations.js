import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { acceptInvitation, declineInvitation, getMyInvitations } from '@/api/invitations';
import { workspaceKeys } from '@/queries/workspaces';
import { applyActiveWorkspaceChange } from '@/lib/workspaceQueryCache';
import { invalidateUserScope, invalidateWorkspaceScope } from '@/lib/invalidationScopes';

export const invitationKeys = {
  all: ['invitations'],
  mine: () => [...invitationKeys.all, 'mine'],
};

export const useMyInvitations = () => {
  return useQuery({
    queryKey: invitationKeys.mine(),
    queryFn: getMyInvitations,
    enabled: !!localStorage.getItem('accessToken'),
    staleTime: 60 * 1000,
  });
};

const invalidateInvitationRelatedData = (queryClient) => {
  invalidateUserScope(queryClient);
  queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
};

export const useAcceptInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: (data) => {
      const workspaceId =
        data?.workspaceId ?? data?.workspace?._id ?? data?.user?.workspaceId ?? null;
      applyActiveWorkspaceChange(queryClient, workspaceId);
      invalidateInvitationRelatedData(queryClient);
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};

export const useDeclineInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: declineInvitation,
    onSuccess: () => {
      invalidateInvitationRelatedData(queryClient);
    },
  });
};
