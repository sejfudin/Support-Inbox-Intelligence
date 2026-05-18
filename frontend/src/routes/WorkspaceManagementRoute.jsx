import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canAccessWorkspaceManagementRoute } from '@/helpers/workspacePermissions';
import { useWorkspace } from '@/queries/workspaces';
import GlobalSkeleton from '@/components/Skeletons/GlobalSkeleton';

export default function WorkspaceManagementRoute() {
  const { user, isAuthenticated, loading } = useAuth();
  const { id } = useParams();
  const { data: workspace, isLoading: isWorkspaceLoading } = useWorkspace(id);

  if (loading || isWorkspaceLoading) {
    return <GlobalSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessWorkspaceManagementRoute(user, workspace, id)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
