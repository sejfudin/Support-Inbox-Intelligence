export const invalidateAnalyticsQueries = (queryClient) => {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'workspaces' &&
      (query.queryKey.includes('analytics') || query.queryKey.includes('user-analytics')),
  });
};
