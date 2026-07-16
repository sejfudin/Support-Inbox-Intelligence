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
import WorkspacesOverviewPage from '@/pages/WorkspacesOverviewPage';
import WorkspaceDetailPage from '@/pages/WorkspaceDetailPage';
import WorkspaceSettingsPage from '@/pages/WorkspaceSettingsPage';
import UserInvitationsPage from '@/pages/UserInvitationsPage';
import AnalyticsDashboard from '@/pages/AnalyticsDashboard';
import AdminUserAnalyticsPage from '@/pages/AdminUserAnalyticsPage';
import AdminReferenceDataPage from '@/pages/AdminReferenceDataPage';
import WorkspaceManagementRoute from '@/routes/WorkspaceManagementRoute';
import SymphonyLayout from '@/layouts/SymphonyLayout';
import LeadershipDashboardPage from '@/pages/fep/LeadershipDashboardPage';
import LeadershipCandidatesPage from '@/pages/fep/LeadershipCandidatesPage';
import LeadershipCandidatePage from '@/pages/fep/LeadershipCandidatePage';
import MentorInternsPage from '@/pages/MentorInternsPage';
import MentorInternProfilePage from '@/pages/MentorInternProfilePage';
import MentorRecommendationsPage from '@/pages/MentorRecommendationsPage';
import MyTechnologiesPage from '@/pages/MyTechnologiesPage';

const WorkspaceGuard = () => {
  const { user } = useAuth();
  if (user?.role === ROLES.LEADERSHIP) {
    return <Navigate to="/programme" replace />;
  }
  if (!user?.workspaceId) return <Navigate to="/create-workspace" replace />;
  return <Outlet />;
};

const HomeRedirect = () => {
  const { user } = useAuth();

  if (user?.role === ROLES.LEADERSHIP) {
    return <Navigate to="/programme" replace />;
  }

  if (user?.role === ROLES.MENTOR && !user?.workspaceId) {
    return <Navigate to="/my-interns" replace />;
  }

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
            user?.role === ROLES.LEADERSHIP ? (
              <Navigate to="/programme" replace />
            ) : user?.role === ROLES.MENTOR ? (
              <CreateWorkspacePage />
            ) : user?.workspaceId ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <CreateWorkspacePage />
            )
          }
        />

        <Route path="/my-internship" element={<Navigate to="/create-workspace" replace />} />

        <Route element={<SymphonyLayout />}>
          <Route element={<ProtectedRoute allowedRoles={[ROLES.LEADERSHIP]} />}>
            <Route path="/programme" element={<LeadershipDashboardPage />} />
            <Route path="/interns" element={<LeadershipCandidatesPage />} />
            <Route path="/interns/:userId" element={<LeadershipCandidatePage />} />
          </Route>
        </Route>

        <Route element={<SidebarLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route
            path="/profile"
            element={
              user?.role === ROLES.LEADERSHIP ? (
                <Navigate to="/programme" replace />
              ) : (
                <ProfilePage />
              )
            }
          />

          <Route path="/invitations" element={<UserInvitationsPage />} />

          <Route element={<ProtectedRoute allowedRoles={[ROLES.INTERN]} />}>
            <Route path="/my-technologies" element={<MyTechnologiesPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.MENTOR]} />}>
            <Route path="/my-interns" element={<MentorInternsPage />} />
            <Route path="/my-interns/:userId" element={<MentorInternProfilePage />} />
            <Route path="/workspaces" element={<WorkspacesOverviewPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MENTOR]} />}>
            <Route path="/recommendations" element={<MentorRecommendationsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/user/:userId" element={<AdminUserAnalyticsPage />} />
            <Route path="/admin/workspaces" element={<WorkspacesOverviewPage />} />
            <Route path="/admin/platform-management" element={<AdminReferenceDataPage />} />
            <Route
              path="/admin/reference-data"
              element={<Navigate to="/admin/platform-management" replace />}
            />
            <Route path="/register" element={<Register />} />
          </Route>

          <Route element={<WorkspaceGuard />}>
            <Route path="/tickets" element={<TicketPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/backlog" element={<BacklogPage />} />

            <Route element={<WorkspaceManagementRoute />}>
              <Route path="/admin/workspaces/:id" element={<WorkspaceDetailPage />} />
              <Route path="/admin/workspaces/:id/settings" element={<WorkspaceSettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
