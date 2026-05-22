import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  initiateGitHubInstallation,
  getIntegration,
  updateIntegration,
  disconnectIntegration,
  getRepositories,
  refreshPR,
  unlinkPR,
} from '@/api/github';
import { invalidateTicketScope, invalidateWorkspaceScope } from '@/lib/invalidationScopes';

export const useIntegration = (workspaceId) => {
  return useQuery({
    queryKey: ['integration', workspaceId],
    queryFn: () => getIntegration(workspaceId),
    enabled: !!workspaceId,
  });
};

export const useRepositories = (workspaceId, isConnected) => {
  return useQuery({
    queryKey: ['repositories', workspaceId],
    queryFn: () => getRepositories(workspaceId),
    enabled: !!workspaceId && isConnected,
  });
};

export const useInitiateGitHubInstallation = () => {
  return useMutation({
    mutationFn: initiateGitHubInstallation,
  });
};

export const useUpdateIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, data }) => updateIntegration(workspaceId, data),
    onSuccess: (_, variables) => {
      invalidateWorkspaceScope(queryClient, variables.workspaceId);
    },
  });
};

export const useDisconnectIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectIntegration,
    onSuccess: (_, workspaceId) => {
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};

export const useRefreshPR = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, workspaceId }) => refreshPR(ticketId, workspaceId),
    onSuccess: (_, variables) => {
      invalidateTicketScope(queryClient, variables.ticketId);
    },
  });
};

export const useUnlinkPR = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlinkPR,
    onSuccess: (_, ticketId) => {
      invalidateTicketScope(queryClient, ticketId);
    },
  });
};
