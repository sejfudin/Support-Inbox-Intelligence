import { authKeys } from '@/queries/auth';
import { invitationKeys } from '@/queries/invitations';
import { workspaceKeys } from '@/queries/workspaces';
import { NOTIFICATIONS_QUERY_KEY } from '@/queries/notifications';
import { clearWorkspaceScopedQueries } from '@/lib/workspaceQueryCache';

/**
 * Drops cached data tied to the previous signed-in user (logout / login as another account).
 */
export const clearSessionQueries = (queryClient) => {
  queryClient.removeQueries({ queryKey: authKeys.all });
  queryClient.removeQueries({ queryKey: workspaceKeys.all });
  queryClient.removeQueries({ queryKey: invitationKeys.all });
  queryClient.removeQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  clearWorkspaceScopedQueries(queryClient);
};
