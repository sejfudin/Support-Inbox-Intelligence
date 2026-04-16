import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAllWorkspaces,
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  switchWorkspace,
  deleteWorkspace,
  getWorkspaceAnalytics,
  getUserAnalytics,
} from '@/api/workspaces';
import { authKeys } from '@/queries/auth';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.mine() });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.allAdmin() });
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};

export const useUpdateWorkspace = (id) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => updateWorkspace(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.mine() });
    },
  });
};

export const useInviteWorkspaceMember = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => inviteWorkspaceMember(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
    },
  });
};

export const useSwitchWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: switchWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      queryClient.removeQueries({ queryKey: ['tickets'] });
      queryClient.removeQueries({ queryKey: ['users'] });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.allAdmin() });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.mine() });
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};

export const useRemoveWorkspaceMember = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => removeWorkspaceMember(workspaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
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
