import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSprints, getCurrentSprint, getSprint, createSprint } from '@/api/sprints';

export const SPRINTS_QUERY_KEY = 'sprints';

export const useSprints = (workspaceId, options = {}) =>
  useQuery({
    queryKey: [SPRINTS_QUERY_KEY, workspaceId],
    queryFn: () => getSprints({ workspaceId }),
    enabled: Boolean(workspaceId),
    ...options,
  });

export const useCurrentSprint = (workspaceId, options = {}) =>
  useQuery({
    queryKey: [SPRINTS_QUERY_KEY, workspaceId, 'current'],
    queryFn: () => getCurrentSprint({ workspaceId }),
    enabled: Boolean(workspaceId),
    ...options,
  });

export const useSprint = (id) =>
  useQuery({
    queryKey: [SPRINTS_QUERY_KEY, id],
    queryFn: () => getSprint(id),
    enabled: Boolean(id),
  });

export const useCreateSprint = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createSprint({ workspaceId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SPRINTS_QUERY_KEY, workspaceId] });
    },
  });
};
