import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSprints,
  getCurrentSprint,
  getSprintLeftovers,
  getSprint,
  createSprint,
  updateSprint,
  deleteSprint,
} from '@/api/sprints';
import { invalidateWorkspaceTicketsScope } from '@/lib/invalidationScopes';

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

// Keyed under the workspace's sprints so a sprint change invalidates it with
// everything else: carrying a leftover forward changes what is left over.
export const useSprintLeftovers = (workspaceId, options = {}) =>
  useQuery({
    queryKey: [SPRINTS_QUERY_KEY, workspaceId, 'leftovers'],
    queryFn: () => getSprintLeftovers({ workspaceId }),
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

export const useUpdateSprint = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => updateSprint({ id, workspaceId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SPRINTS_QUERY_KEY, workspaceId] });
    },
  });
};

// Deleting a sprint detaches its tickets, so the ticket caches are stale too —
// the board and the planning modal's source panes both read off them.
export const useDeleteSprint = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }) => deleteSprint({ id, workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SPRINTS_QUERY_KEY, workspaceId] });
      invalidateWorkspaceTicketsScope(queryClient, workspaceId);
    },
  });
};
