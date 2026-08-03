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

export const TOUR_VERSION = '2026-08-shell-redesign';
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
    title: 'The app has a new look',
    body: 'Same features, tidier shell. A few controls moved — here is where they went. This takes about 20 seconds.',
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
  {
    id: 'admin-dashboard',
    roles: ['admin'],
    target: '[data-tour="page-content"]',
    title: 'Your dashboard is new',
    body: 'Dashboard now opens a workspace overview: who is in today, each intern’s workload and attendance, recent placements and standup coverage.',
    placement: 'left',
  },
];
