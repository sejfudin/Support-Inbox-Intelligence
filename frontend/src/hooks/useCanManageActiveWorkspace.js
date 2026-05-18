import { useAuth } from '@/context/AuthContext';
import { canManageWorkspace } from '@/helpers/workspacePermissions';
import { useWorkspace } from '@/queries/workspaces';

export function useCanManageActiveWorkspace() {
  const { user } = useAuth();
  const { data: workspace, isLoading, isFetching } = useWorkspace(user?.workspaceId);

  const canManage = Boolean(user?.workspaceId && canManageWorkspace(user, workspace));

  return {
    canManage,
    workspace,
    isLoading: Boolean(user?.workspaceId) && (isLoading || isFetching),
  };
}
