import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTaskStatuses,
  createTaskStatus,
  updateTaskStatus,
  deleteTaskStatus,
  reorderTaskStatuses,
} from '@/api/taskStatuses';

export const TASK_STATUSES_QUERY_KEY = 'task-statuses';

export const taskStatusKeys = {
  byWorkspace: (workspaceId) => [TASK_STATUSES_QUERY_KEY, workspaceId],
};

export const useTaskStatusesQuery = (workspaceId, options = {}) => {
  return useQuery({
    queryKey: taskStatusKeys.byWorkspace(workspaceId),
    queryFn: async () => {
      const result = await getTaskStatuses(workspaceId);
      return result.data ?? [];
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useCreateTaskStatus = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTaskStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskStatusKeys.byWorkspace(workspaceId) });
    },
  });
};

export const useUpdateTaskStatus = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => updateTaskStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskStatusKeys.byWorkspace(workspaceId) });
    },
  });
};

export const useDeleteTaskStatus = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTaskStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskStatusKeys.byWorkspace(workspaceId) });
    },
  });
};

export const useReorderTaskStatuses = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderTaskStatuses,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskStatusKeys.byWorkspace(workspaceId) });
    },
  });
};
