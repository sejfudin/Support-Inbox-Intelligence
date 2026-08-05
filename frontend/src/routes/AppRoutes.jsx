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
import { ROLES, isAdmin, isIntern } from '@/helpers/roles';
import UserDashboard from '@/pages/UserDashboard';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import InternDashboardPage from '@/pages/InternDashboardPage';
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
import LeadershipProjectsPage from '@/pages/fep/LeadershipProjectsPage';
import LeadershipProjectPage from '@/pages/fep/LeadershipProjectPage';
import MentorInternsPage from '@/pages/MentorInternsPage';
import MentorInternProfilePage from '@/pages/MentorInternProfilePage';
import MentorRecommendationsPage from '@/pages/MentorRecommendationsPage';
import SpecializationPage from '@/pages/SpecializationPage';
import MyTechnologiesPage from '@/pages/MyTechnologiesPage';
import MyAttendancePage from '@/pages/MyAttendancePage';
import AttendanceOverviewPage from '@/pages/AttendanceOverviewPage';
import WorkspaceDailiesPage from '@/pages/WorkspaceDailiesPage';
import AdminDailyInsightsPage from '@/pages/AdminDailyInsightsPage';

const WorkspaceGuard = () => {
  const { user } = useAuth();
  if (user?.role === ROLES.LEADERSHIP) {
    return <Navigate to="/programme" replace />;
  }
  if (!user?.workspaceId) return <Navigate to="/create-workspace" replace />;
  return <Outlet />;
};

/**
 * `/dashboard` is role-split three ways: admins get the workspace-scoped admin
 * board, interns get their own board, and mentors keep the assigned-tickets
 * table that used to serve everyone.
 *
 * It sits outside `WorkspaceGuard` so an admin with no active workspace ("Global
 * admin mode") gets the board's own explanation instead of being bounced to
 * `/create-workspace`, which is not what an admin without a workspace wants. The
 * intern board is outside it for the same reason: attendance, pipeline and
 * evaluations are programme-level and do not need a workspace, so an intern
 * between workspaces gets an explanation on the board rather than a redirect
 * into workspace creation, which is not theirs to do. Widening WorkspaceGuard
 * itself would let both into /tickets and /dailies without a workspace, which
 * those pages do not handle — hence the repeated check on the mentor branch only.
 */
const DashboardRoute = () => {
  const { user } = useAuth();

  if (user?.role === ROLES.LEADERSHIP) {
    return <Navigate to="/programme" replace />;
  }
  if (isAdmin(user?.role)) {
    return <AdminDashboardPage />;
  }
  if (isIntern(user?.role)) {
    return <InternDashboardPage />;
  }
  if (!user?.workspaceId) {
    return <Navigate to="/create-workspace" replace />;
  }
  return <UserDashboard />;
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
            <Route path="/projects" element={<LeadershipProjectsPage />} />
            <Route path="/projects/:id" element={<LeadershipProjectPage />} />
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
            <Route path="/my-attendance" element={<MyAttendancePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.MENTOR]} />}>
            <Route path="/my-interns" element={<MentorInternsPage />} />
            <Route path="/my-interns/:userId" element={<MentorInternProfilePage />} />
            <Route path="/workspaces" element={<WorkspacesOverviewPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/attendance" element={<AttendanceOverviewPage />} />
            <Route path="/admin/daily-insights" element={<AdminDailyInsightsPage />} />
            <Route path="/recommendations" element={<MentorRecommendationsPage />} />
            <Route path="/specialization" element={<SpecializationPage />} />
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

          <Route path="/dashboard" element={<DashboardRoute />} />

          <Route element={<WorkspaceGuard />}>
            {/* The intern board's "View all" and its workload card link here as
                `/tickets?assignee=me` — the same table everyone else uses with the
                assignee filter pre-applied, rather than a second list page to keep
                in sync. */}
            <Route path="/tickets" element={<TicketPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/backlog" element={<BacklogPage />} />
            <Route path="/dailies" element={<WorkspaceDailiesPage />} />

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
