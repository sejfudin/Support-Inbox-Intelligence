import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSprintSummary, generateSprintSummary } from '@/api/sprintSummaries';
import { SPRINTS_QUERY_KEY } from '@/queries/sprints';

// Keyed under the workspace's sprints so a sprint change (or a leftover carried
// forward, which reseals the previous sprint) invalidates the recap with
// everything else.
const summaryKey = (workspaceId, sprintId) => [SPRINTS_QUERY_KEY, workspaceId, 'summary', sprintId];

export const useSprintSummary = (workspaceId, sprintId, options = {}) =>
  useQuery({
    queryKey: summaryKey(workspaceId, sprintId),
    queryFn: () => getSprintSummary({ workspaceId, sprintId }),
    enabled: Boolean(workspaceId && sprintId),
    ...options,
  });

// The POST returns the same shape as the GET, so its result seeds the query
// cache directly — no refetch after a generate.
export const useGenerateSprintSummary = (workspaceId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sprintId }) => generateSprintSummary({ workspaceId, sprintId }),
    onSuccess: (response, { sprintId }) => {
      queryClient.setQueryData(summaryKey(workspaceId, sprintId), response);
    },
  });
};
