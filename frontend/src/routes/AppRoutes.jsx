import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import Register from '@/pages/Register';
import TicketPage from '@/pages/TicketPage';
import SidebarLayout from '@/layouts/SidebarLayout';
import AdminUsersPage from '@/pages/AdminUsersPage';
import ArchivePage from '@/pages/Archive';
import BacklogPage from '@/pages/Backlog';
import ProfilePage from '@/pages/ProfilePage';
import ProtectedRoute from '@/routes/ProtectedRoutes';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/helpers/roles';
import UserDashboard from '@/pages/UserDashboard';
import SetupPasswordWrapper from '@/pages/SetupPasswordWrapper';
import CreateWorkspacePage from '@/pages/CreateWorkspacePage';
import AdminWorkspacesPage from '@/pages/AdminWorkspacesPage';
import WorkspaceDetailPage from '@/pages/WorkspaceDetailPage';
import WorkspaceSettingsPage from '@/pages/WorkspaceSettingsPage';
import UserInvitationsPage from '@/pages/UserInvitationsPage';
import AnalyticsDashboard from '@/pages/AnalyticsDashboard';
import AdminUserAnalyticsPage from '@/pages/AdminUserAnalyticsPage';
import AdminReferenceDataPage from '@/pages/AdminReferenceDataPage';
import WorkspaceManagementRoute from '@/routes/WorkspaceManagementRoute';

const WorkspaceGuard = () => {
  const { user } = useAuth();
  if (!user?.workspaceId) return <Navigate to="/create-workspace" replace />;
  return <Outlet />;
};

const HomeRedirect = () => {
  const { user } = useAuth();

  if (user?.workspaceId) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user?.role === ROLES.ADMIN) {
    return <Navigate to="/admin/workspaces" replace />;
  }

  return <Navigate to="/create-workspace" replace />;
};

export default function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      <Route path="/set-password" element={<SetupPasswordWrapper />} />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/create-workspace"
          element={
            user?.workspaceId ? <Navigate to="/dashboard" replace /> : <CreateWorkspacePage />
          }
        />

        <Route element={<SidebarLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/user/:userId" element={<AdminUserAnalyticsPage />} />
            <Route path="/admin/workspaces" element={<AdminWorkspacesPage />} />
            <Route path="/admin/platform-management" element={<AdminReferenceDataPage />} />
            <Route
              path="/admin/reference-data"
              element={<Navigate to="/admin/platform-management" replace />}
            />
            <Route path="/register" element={<Register />} />
          </Route>

          <Route element={<WorkspaceGuard />}>
            <Route path="/tickets" element={<TicketPage />} />
            <Route path="/admin/archive" element={<ArchivePage />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/invitations" element={<UserInvitationsPage />} />

            <Route element={<WorkspaceManagementRoute />}>
              <Route path="/admin/workspaces/:id" element={<WorkspaceDetailPage />} />
              <Route path="/admin/workspaces/:id/settings" element={<WorkspaceSettingsPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
              <Route path="/admin/backlog" element={<BacklogPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
