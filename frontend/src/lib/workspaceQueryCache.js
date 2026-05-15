import { authKeys } from '@/queries/auth';
import { NOTIFICATIONS_QUERY_KEY } from '@/queries/notifications';

/**
 * Drops cached data tied to the previous active workspace so lists/settings refetch
 * after create, switch, or invite acceptance.
 */
export const clearWorkspaceScopedQueries = (queryClient) => {
  queryClient.removeQueries({ queryKey: ['tickets'] });
  queryClient.removeQueries({ queryKey: ['ticket'] });
  queryClient.removeQueries({ queryKey: ['ticket-history'] });
  queryClient.removeQueries({ queryKey: ['users'] });
  queryClient.removeQueries({ queryKey: ['ticket-statuses'] });
  queryClient.removeQueries({ queryKey: ['categories'] });
  queryClient.removeQueries({ queryKey: ['integration'] });
  queryClient.removeQueries({ queryKey: ['repositories'] });
  queryClient.removeQueries({ queryKey: ['comments'] });

  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'workspaces' &&
      (query.queryKey.includes('analytics') || query.queryKey.includes('user-analytics')),
  });
  queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
};

/**
 * Optimistically point /me at the new workspace, then clear workspace-scoped caches.
 */
export const applyActiveWorkspaceChange = (queryClient, workspaceId) => {
  if (workspaceId) {
    const nextId = workspaceId?.toString?.() ?? workspaceId;

    queryClient.setQueryData(authKeys.me(), (currentUser) => {
      if (!currentUser) return currentUser;
      return {
        ...currentUser,
        workspaceId: nextId,
      };
    });
  }

  clearWorkspaceScopedQueries(queryClient);
  queryClient.invalidateQueries({ queryKey: authKeys.me() });
};
