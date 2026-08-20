import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canAccessWorkspaceManagementRoute } from '@/helpers/workspacePermissions';
import { useWorkspace } from '@/queries/workspaces';

export default function WorkspaceManagementRoute() {
  const { user, isAuthenticated, loading } = useAuth();
  const { id } = useParams();
  const { data: workspace, isLoading: isWorkspaceLoading } = useWorkspace(id);

  // Nothing is decided until both the user and the workspace are known — the access check needs
  // both, and redirecting on a half-resolved session would bounce a signed-in admin out on every
  // reload.
  const resolved = !loading && !isWorkspaceLoading;

  // No splash of its own. This guard sits on `/admin/workspaces/:id` and its settings page, both
  // of which are reached by a direct link rather than through any menu, and both of which draw
  // their own wait — the detail page in skeletons, the settings page with the loader in its body.
  // A second full-screen animation stacked in front of those would be a wait invented on top of
  // a wait that was already handled.
  if (!resolved) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessWorkspaceManagementRoute(user, workspace, id)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
