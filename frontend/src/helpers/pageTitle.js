import { matchPath } from 'react-router-dom';

export const APP_NAME = 'Task Manager';

/**
 * Every route gets a browser-tab title of its own. The map below is the baseline
 * — the name of the *place*, matching the nav label the user clicked, so the tab
 * and the sidebar agree. Pages that show one named thing (a ticket, a workspace,
 * an intern) override it with that thing's name via `useDocumentTitle`, which
 * runs after the baseline is applied (see `routes/RouteTitle.jsx`).
 *
 * Order matters: the first pattern that matches wins, so the more specific path
 * has to come before the prefix it extends.
 */
const ROUTE_TITLES = [
  { path: '/login', title: 'Sign in' },
  { path: '/set-password', title: 'Set your password' },
  { path: '/register', title: 'Add user' },
  { path: '/create-workspace', title: 'Create workspace' },

  // Leadership (Symphony)
  { path: '/programme', title: 'Programme dashboard' },
  { path: '/interns/:userId', title: 'Candidate' },
  { path: '/interns', title: 'Candidates' },
  { path: '/projects/:id', title: 'Project' },
  { path: '/projects', title: 'Projects' },
  { path: '/requests', title: 'Requests' },

  // Account
  { path: '/profile', title: 'Profile' },
  { path: '/settings', title: 'Settings' },
  { path: '/invitations', title: 'Invitations' },

  // Intern
  { path: '/my-progress', title: 'My progress' },
  { path: '/my-technologies', title: 'Position & technologies' },
  { path: '/my-attendance', title: 'Attendance' },

  // Mentor
  { path: '/my-interns/:userId', title: 'Intern' },
  { path: '/my-interns', title: 'My interns' },
  { path: '/workspaces', title: 'My workspaces' },

  // Admin
  { path: '/admin/workspaces/:id/settings', title: 'Workspace settings' },
  { path: '/admin/workspaces/:id', title: 'Workspace' },
  { path: '/admin/workspaces', title: 'All workspaces' },
  { path: '/admin/users', title: 'All users' },
  { path: '/admin/absence-requests', title: 'Absence requests' },
  { path: '/admin/daily-insights', title: 'Daily insights' },
  { path: '/admin/platform-management', title: 'Platform management' },
  { path: '/admin/staffing-requests', title: 'Requests' },
  { path: '/attendance', title: 'Attendance' },
  { path: '/recommendations', title: 'Recommendations' },
  { path: '/specialization', title: 'Specialization' },
  { path: '/user/:userId', title: 'User' },

  // Workspace
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/sprints', title: 'Sprints' },
  { path: '/tickets', title: 'Tickets' },
  { path: '/archive', title: 'Archive' },
  { path: '/analytics', title: 'Analytics' },
  { path: '/backlog', title: 'Backlog' },
  { path: '/dailies', title: 'Dailies' },
];

/** Longest sensible tab label — anything past this is ellipsized. */
const MAX_TITLE_LENGTH = 60;

/**
 * `"Fix the login redirect · Task Manager"`. A page with no title of its own
 * falls back to the bare app name rather than a dangling separator.
 */
export const formatPageTitle = (title) => {
  const trimmed = String(title ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!trimmed) return APP_NAME;
  const clipped =
    trimmed.length > MAX_TITLE_LENGTH
      ? `${trimmed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`
      : trimmed;
  return `${clipped} · ${APP_NAME}`;
};

/** The baseline title for a pathname, or `''` for a route with no entry. */
export const resolveRouteTitle = (pathname) => {
  const match = ROUTE_TITLES.find((entry) => matchPath({ path: entry.path, end: true }, pathname));
  return match ? match.title : '';
};
