import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAllWorkspaces,
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  cancelWorkspaceInvitation,
  switchWorkspace,
  deleteWorkspace,
  getWorkspaceAnalytics,
  getUserAnalytics,
  uploadWorkspaceLogo,
  deleteWorkspaceLogo,
} from '@/api/workspaces';
import { applyActiveWorkspaceChange } from '@/lib/workspaceQueryCache';
import { invalidateUserScope, invalidateWorkspaceScope } from '@/lib/invalidationScopes';

export const workspaceKeys = {
  all: ['workspaces'],
  mine: () => [...workspaceKeys.all, 'mine'],
  allAdmin: () => [...workspaceKeys.all, 'admin-all'],
  detail: (id) => [...workspaceKeys.all, id],
  analytics: (id, days) => [...workspaceKeys.all, id, 'analytics', days],
  userAnalytics: ({ userId, workspaceId, days }) => [
    ...workspaceKeys.all,
    workspaceId,
    'user-analytics',
    userId,
    days,
  ],
};

export const useAllWorkspaces = () => {
  return useQuery({
    queryKey: workspaceKeys.allAdmin(),
    queryFn: getAllWorkspaces,
    staleTime: 2 * 60 * 1000,
  });
};

export const useMyWorkspaces = () => {
  return useQuery({
    queryKey: workspaceKeys.mine(),
    queryFn: getMyWorkspaces,
    enabled: !!localStorage.getItem('accessToken'),
    staleTime: 5 * 60 * 1000,
  });
};

export const useWorkspace = (id) => {
  return useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: () => getWorkspace(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: (workspace) => {
      const workspaceId = workspace?._id ?? workspace?.id;
      applyActiveWorkspaceChange(queryClient, workspaceId);
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};

export const useUpdateWorkspace = (id) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => updateWorkspace(id, data),
    onSuccess: () => {
      invalidateWorkspaceScope(queryClient, id);
    },
  });
};

export const useInviteWorkspaceMember = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => inviteWorkspaceMember(workspaceId, data),
    onSuccess: () => {
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};

export const useSwitchWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: switchWorkspace,
    onSuccess: (_, workspaceId) => {
      applyActiveWorkspaceChange(queryClient, workspaceId);
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.allAdmin() });
      invalidateUserScope(queryClient);
    },
  });
};

export const useRemoveWorkspaceMember = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => removeWorkspaceMember(workspaceId, userId),
    onSuccess: () => {
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};

export const useCancelWorkspaceInvitation = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId) => cancelWorkspaceInvitation(workspaceId, invitationId),
    onSuccess: () => {
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};

export const useWorkspaceAnalytics = ({ workspaceId, days = 30 }) => {
  return useQuery({
    queryKey: workspaceKeys.analytics(workspaceId, days),
    queryFn: () => getWorkspaceAnalytics(workspaceId, days),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useUserAnalytics = ({ userId, workspaceId, days = 30 }) => {
  return useQuery({
    queryKey: workspaceKeys.userAnalytics({ userId, workspaceId, days }),
    queryFn: () => getUserAnalytics({ userId, workspaceId, days }),
    enabled: !!userId && !!workspaceId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
};

export const useUploadWorkspaceLogo = (id) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file) => uploadWorkspaceLogo(id, file),
    onSuccess: () => {
      invalidateWorkspaceScope(queryClient, id);
    },
  });
};

export const useDeleteWorkspaceLogo = (id) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteWorkspaceLogo(id),
    onSuccess: () => {
      invalidateWorkspaceScope(queryClient, id);
    },
  });
};
