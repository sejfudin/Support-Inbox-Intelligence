/**
 * The "what moved" script for the app-shell redesign.
 *
 * Each step either points at a real element (`target`, a `[data-tour]` selector)
 * or has none, in which case the card is centred and reads as a plain notice.
 * Steps whose target is absent or not rendered — a role without that control, or
 * a viewport where it is hidden — are dropped at runtime, so this list does not
 * need a branch per role.
 *
 * `roles` narrows a step to specific platform roles when the *copy* only applies
 * to them, which is not the same thing as the element existing.
 *
 * Bump TOUR_VERSION to re-announce: it is the localStorage value, so a new string
 * shows the tour again to everyone exactly once.
 */

export const TOUR_VERSION = '2026-08-shell-redesign-r2';
export const TOUR_STORAGE_KEY = 'whatsNewTour';

/**
 * Replaying the tour on demand (the "What's new" item in the user menu).
 *
 * A window event rather than a context: the only publisher is one menu item and
 * the only subscriber is one component, so a provider wrapping the whole app
 * would be plumbing for its own sake.
 */
export const TOUR_REPLAY_EVENT = 'whatsnew:replay';

export const replayWhatsNewTour = () => {
  window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
};

export const WHATS_NEW_STEPS = [
  {
    id: 'intro',
    title: 'Task Manager has a new look',
    body: 'Same features, tidier shell — plus a new dashboard if you are an admin. A few controls moved; here is where they went.',
  },
  {
    id: 'collapse',
    target: '[data-tour="sidebar-collapse"]',
    title: 'Collapse the sidebar',
    body: 'The menu folds down to a slim icon rail when you want the full width for a board or a wide table. Your choice is remembered.',
    placement: 'right',
  },
  {
    id: 'user-menu',
    target: '[data-tour="user-menu"]',
    title: 'Profile, theme and logout live here',
    body: 'These used to be a separate Logout button and a floating palette icon. They are now one menu on your name at the bottom of the sidebar.',
    placement: 'right',
  },
  {
    id: 'notifications',
    target: '[data-tour="notifications"]',
    title: 'Notifications moved down here',
    body: 'The bell no longer floats over the top-right of the page — it sits next to your name, and still shows a dot when something is unread.',
    placement: 'right',
  },
  // Both of these point at the page area itself, so it stays lit while the rest of
  // the shell dims and the card is pushed off to the side — you can see what is
  // being described instead of reading about it through a covering panel.
  {
    id: 'full-bleed',
    target: '[data-tour="page-content"]',
    title: 'Pages use the full width',
    body: 'Screens are no longer boxed into a narrow column, so long ticket tables and boards have room to breathe.',
    placement: 'left',
  },
  // Switching workspace re-points the board, so it comes before the tour walks
  // through what is on that board.
  {
    id: 'workspace-switcher',
    target: '[data-tour="workspace-switcher"]',
    title: 'Switching workspace changes everything below it',
    body: 'Pick a workspace here and the whole app follows — tickets, dailies and, for admins, every number on the dashboard. One workspace at a time, always the one named here.',
    placement: 'right',
  },

  // The new dashboard, card by card. All admin-only, and all targeting elements
  // that exist only on the dashboard itself — on any other page these steps drop
  // out on their own, so the tour never points at something that is not there.
  {
    id: 'admin-dashboard',
    roles: ['admin'],
    target: '[data-tour="page-content"]',
    title: 'Your dashboard is new',
    body: 'It used to be your ticket list. It is now an overview of the workspace you are in — let us walk the four parts.',
    placement: 'left',
  },
  {
    id: 'dashboard-presence',
    roles: ['admin'],
    target: '[data-tour="dashboard-presence"]',
    title: 'Who is in today',
    body: 'Check-ins against the interns in this workspace, this month’s average attendance, and a list of who has not checked in yet. Absence is derived from a missing check-in, not recorded by hand.',
  },
  {
    id: 'dashboard-interns',
    roles: ['admin'],
    target: '[data-tour="dashboard-interns"]',
    title: 'Workload and attendance per intern',
    body: 'Open tickets split across To do, In progress, On staging and Blocked, plus each intern’s attendance for the month. Only interns still in the programme appear here.',
  },
  {
    id: 'dashboard-placements',
    roles: ['admin'],
    target: '[data-tour="dashboard-placements"]',
    title: 'Placements & specializations — across every workspace',
    body: 'The one panel that is not scoped to your current workspace: placement and specialization are both programme milestones, so this shows the latest across all of them — recent placements on the left, the newest specialization assignments on the right.',
  },
  {
    id: 'dashboard-quick-actions',
    roles: ['admin'],
    target: '[data-tour="dashboard-quick-actions"]',
    title: 'Quick actions',
    body: 'Assign a ticket, recommend an intern or write an evaluation without leaving this page — each opens right here. Marking an absence is still to come.',
  },
  {
    id: 'dashboard-standup',
    roles: ['admin'],
    target: '[data-tour="dashboard-standup"]',
    title: 'Standup coverage',
    body: 'How many interns have filed today’s note, and any open blockers. Open the board for the full picture.',
  },
];
