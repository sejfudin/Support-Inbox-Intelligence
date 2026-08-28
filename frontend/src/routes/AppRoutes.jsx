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
import SettingsPage from '@/pages/SettingsPage';
import ProtectedRoute from '@/routes/ProtectedRoutes';
import RouteTitle from '@/routes/RouteTitle';
import { useAuth } from '@/context/AuthContext';
import { ROLES, isAdmin, isIntern } from '@/helpers/roles';
import MentorDashboardPage from '@/pages/MentorDashboardPage';
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
import { readStoredPreference } from '@/hooks/useStoredPreference';
import {
  DEFAULT_LANDING_PAGE,
  LANDING_PAGE_STORAGE_KEY,
  isValidLandingPage,
  landingPageEntry,
} from '@/helpers/uiPreferences';
import SymphonyLayout from '@/layouts/SymphonyLayout';
import LeadershipDashboardPage from '@/pages/fep/LeadershipDashboardPage';
import LeadershipCandidatesPage from '@/pages/fep/LeadershipCandidatesPage';
import LeadershipCandidatePage from '@/pages/fep/LeadershipCandidatePage';
import LeadershipProjectsPage from '@/pages/fep/LeadershipProjectsPage';
import LeadershipProjectPage from '@/pages/fep/LeadershipProjectPage';
import LeadershipRequestsPage from '@/pages/fep/LeadershipRequestsPage';
import MentorInternsPage from '@/pages/MentorInternsPage';
import MentorInternProfilePage from '@/pages/MentorInternProfilePage';
import MentorRecommendationsPage from '@/pages/MentorRecommendationsPage';
import SpecializationPage from '@/pages/SpecializationPage';
import MyTechnologiesPage from '@/pages/MyTechnologiesPage';
import MyProgressPage from '@/pages/MyProgressPage';
import MyAttendancePage from '@/pages/MyAttendancePage';
import AttendanceOverviewPage from '@/pages/AttendanceOverviewPage';
import AdminAbsenceRequestsPage from '@/pages/AdminAbsenceRequestsPage';
import WorkspaceDailiesPage from '@/pages/WorkspaceDailiesPage';
import AdminDailyInsightsPage from '@/pages/AdminDailyInsightsPage';
import AdminStaffingRequestsPage from '@/pages/AdminStaffingRequestsPage';

const WorkspaceGuard = () => {
  const { user, loading } = useAuth();
  // Nothing to guard against until the session lands. Every check below reads a field off `user`,
  // and on a cold reload that is `undefined` for the length of the boot — so redirecting here
  // would bounce someone off the URL they typed before we knew whether they could see it. The
  // children mount under the boot splash and start what they can; see `ProtectedRoutes.jsx`.
  if (loading) return <Outlet />;
  if (user?.role === ROLES.LEADERSHIP) {
    return <Navigate to="/programme" replace />;
  }
  if (!user?.workspaceId) return <Navigate to="/create-workspace" replace />;
  return <Outlet />;
};

/**
 * `/dashboard` is role-split three ways: admins get the workspace-scoped admin
 * board, interns get their own board, and mentors get their own board too —
 * their assigned interns, ticket work, notes from admin/leadership and quick
 * actions, all already scoped server-side to the caller.
 *
 * It sits outside `WorkspaceGuard` so an admin with no active workspace ("Global
 * admin mode") gets the board's own explanation instead of being bounced to
 * `/create-workspace`, which is not what an admin without a workspace wants. The
 * intern and mentor boards are outside it for the same reason: a mentor between
 * workspaces still has interns, notes and quick actions to see — only the
 * ticket-work card and "Assign a ticket" need one, and `MentorDashboardPage`
 * handles that itself rather than redirecting the whole board away. Widening
 * `WorkspaceGuard` itself would let all three into /tickets and /dailies without
 * a workspace, which those pages do not handle — hence no repeated check here.
 */
const DashboardRoute = () => {
  const { user, loading } = useAuth();

  // The split is on role, so there is no branch to take until the session lands. The boot splash
  // is up over this, so the person sees the mark rather than a blank frame.
  if (loading) return null;
  if (user?.role === ROLES.LEADERSHIP) {
    return <Navigate to="/programme" replace />;
  }
  if (isAdmin(user?.role)) {
    return <AdminDashboardPage />;
  }
  if (isIntern(user?.role)) {
    return <InternDashboardPage />;
  }
  return <MentorDashboardPage />;
};

const HomeRedirect = () => {
  const { user, loading } = useAuth();

  // Every branch here is a redirect, and the last one is unconditional — running them on a session
  // that has not resolved would send everyone to /create-workspace on a cold load of `/`.
  if (loading) return null;

  if (user?.role === ROLES.LEADERSHIP) {
    return <Navigate to="/programme" replace />;
  }

  if (user?.role === ROLES.MENTOR && !user?.workspaceId) {
    return <Navigate to="/my-interns" replace />;
  }

  if (user?.workspaceId) {
    // Settings → Workspace defaults → Landing page. Read here rather than at
    // sign-in so it also applies to a bookmark on `/`. Leadership never reaches
    // this line, and the workspace-scoped targets are gated by the branch above,
    // so a stored preference can never redirect someone somewhere they cannot go.
    const landing = landingPageEntry(
      readStoredPreference(LANDING_PAGE_STORAGE_KEY, DEFAULT_LANDING_PAGE, isValidLandingPage)
    );
    return <Navigate to={landing.path} replace />;
  }

  if (user?.role === ROLES.ADMIN) {
    return <Navigate to="/admin/workspaces" replace />;
  }

  return <Navigate to="/create-workspace" replace />;
};

export default function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  return (
    <>
      <RouteTitle />
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
              <Route path="/requests" element={<LeadershipRequestsPage />} />
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

            {/* Reached from the account menu in the sidebar footer, not from a nav
              row — settings are per-person, not a place in the workspace. */}
            <Route path="/settings" element={<SettingsPage />} />

            <Route path="/invitations" element={<UserInvitationsPage />} />

            <Route element={<ProtectedRoute allowedRoles={[ROLES.INTERN]} />}>
              <Route path="/my-technologies" element={<MyTechnologiesPage />} />
              {/* Programme data, not workspace data — so it sits with the other
                intern-only routes outside `WorkspaceGuard`. An intern between
                workspaces still has evaluations, readiness and recommendations,
                and bouncing them to /create-workspace to read their own review
                history would be nonsense. */}
              <Route path="/my-progress" element={<MyProgressPage />} />
              <Route path="/my-attendance" element={<MyAttendancePage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[ROLES.MENTOR]} />}>
              <Route path="/my-interns" element={<MentorInternsPage />} />
              <Route path="/my-interns/:userId" element={<MentorInternProfilePage />} />
              <Route path="/workspaces" element={<WorkspacesOverviewPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
              <Route path="/attendance" element={<AttendanceOverviewPage />} />
              <Route path="/admin/absence-requests" element={<AdminAbsenceRequestsPage />} />
              <Route path="/admin/daily-insights" element={<AdminDailyInsightsPage />} />
              <Route path="/recommendations" element={<MentorRecommendationsPage />} />
              <Route path="/specialization" element={<SpecializationPage />} />
              <Route path="/admin/staffing-requests" element={<AdminStaffingRequestsPage />} />
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
    </>
  );
}
