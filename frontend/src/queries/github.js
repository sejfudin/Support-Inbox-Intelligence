import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  initiateGitHubInstallation,
  getIntegration,
  updateIntegration,
  disconnectIntegration,
  getRepositories,
} from "@/api/github";

export const useIntegration = (workspaceId) => {
  return useQuery({
    queryKey: ["integration", workspaceId],
    queryFn: () => getIntegration(workspaceId),
    enabled: !!workspaceId,
  });
};

export const useRepositories = (workspaceId, isConnected) => {
  return useQuery({
    queryKey: ["repositories", workspaceId],
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
      queryClient.invalidateQueries({ queryKey: ["integration", variables.workspaceId] });
    },
  });
};

export const useDisconnectIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectIntegration,
    onSuccess: (_, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ["integration", workspaceId] });
    },
  });
};
