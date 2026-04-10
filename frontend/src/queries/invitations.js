import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { acceptInvitation, declineInvitation, getMyInvitations } from '@/api/invitations';
import { authKeys } from '@/queries/auth';
import { workspaceKeys } from '@/queries/workspaces';

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
  queryClient.invalidateQueries({ queryKey: invitationKeys.mine() });
  queryClient.invalidateQueries({ queryKey: authKeys.me() });
  queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
};

export const useAcceptInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      invalidateInvitationRelatedData(queryClient);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.mine() });
      queryClient.removeQueries({ queryKey: ['tickets'] });
      queryClient.removeQueries({ queryKey: ['users'] });
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
