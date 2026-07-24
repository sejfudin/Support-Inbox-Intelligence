import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  getDaily,
  getDailyHistory,
  startDaily,
  addDailyEntry,
  updateDailyEntry,
  removeDailyEntry,
  getWorkspaceDailyOverview,
  getMemberDailyEntry,
} from '@/api/dailies';
import { invalidateWorkspaceDailiesScope } from '@/lib/invalidationScopes';

export const useDaily = (workspaceId, date, options = {}) => {
  return useQuery({
    queryKey: ['dailies', workspaceId, date],
    queryFn: () => getDaily({ workspace: workspaceId, date }),
    enabled: !!workspaceId && !!date,
    ...options,
  });
};

export const useDailyHistory = (workspaceId, options = {}) => {
  return useQuery({
    queryKey: ['dailies-history', workspaceId],
    queryFn: () => getDailyHistory({ workspace: workspaceId }),
    enabled: !!workspaceId,
    ...options,
  });
};

export const useStartDaily = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date) => startDaily({ workspace: workspaceId, date }),
    onSuccess: () => {
      invalidateWorkspaceDailiesScope(queryClient, workspaceId);
    },
  });
};

export const useAddDailyEntry = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addDailyEntry,
    onSuccess: () => {
      invalidateWorkspaceDailiesScope(queryClient, workspaceId);
    },
  });
};

export const useUpdateDailyEntry = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDailyEntry,
    onSuccess: () => {
      invalidateWorkspaceDailiesScope(queryClient, workspaceId);
    },
  });
};

export const useRemoveDailyEntry = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeDailyEntry,
    onSuccess: () => {
      invalidateWorkspaceDailiesScope(queryClient, workspaceId);
    },
  });
};

// Admin-only. Key stays under the same ['dailies', workspaceId, ...] prefix so it
// rides the existing workspace-dailies socket invalidation scope for free.
export const useWorkspaceDailyOverview = (workspaceId, month, options = {}) => {
  return useQuery({
    queryKey: ['dailies', workspaceId, 'overview', month],
    queryFn: () => getWorkspaceDailyOverview({ workspace: workspaceId, month }),
    enabled: !!workspaceId && !!month,
    placeholderData: keepPreviousData,
    ...options,
  });
};

export const useMemberDailyEntry = (workspaceId, memberId, date, options = {}) => {
  return useQuery({
    queryKey: ['dailies', workspaceId, 'entry', memberId, date],
    queryFn: () => getMemberDailyEntry({ workspace: workspaceId, member: memberId, date }),
    enabled: !!workspaceId && !!memberId && !!date,
    ...options,
  });
};
