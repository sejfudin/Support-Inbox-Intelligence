export const invalidateAnalyticsQueries = (queryClient, workspaceId = null) => {
  const scopedWorkspaceId = workspaceId ? String(workspaceId) : null;

  queryClient.invalidateQueries({
    predicate: (query) => {
      if (!Array.isArray(query.queryKey) || query.queryKey[0] !== 'workspaces') {
        return false;
      }

      if (!query.queryKey.includes('analytics') && !query.queryKey.includes('user-analytics')) {
        return false;
      }

      return !scopedWorkspaceId || String(query.queryKey[1]) === scopedWorkspaceId;
    },
  });
};
