import { authKeys } from '@/queries/auth';
import { invalidateUserScope } from '@/lib/invalidationScopes';

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

  invalidateUserScope(queryClient);
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
