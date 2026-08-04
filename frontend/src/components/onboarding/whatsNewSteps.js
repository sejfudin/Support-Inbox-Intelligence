/**
 * The script for how we announce what's new. This is the mechanism for it — the
 * tour's closing step tells people so out loud, so releases are expected to keep
 * arriving through here rather than through a changelog nobody opens.
 *
 * **Shipping a release through this is two steps, and both are required:**
 *
 * 1. Add or edit the steps below.
 * 2. Bump `TOUR_VERSION`. This is what makes the dashboard's "Notice some
 *    changes?" button glow again for everyone, exactly once — the string is the
 *    localStorage value, so a new one puts every viewer back into "not seen yet".
 *    Editing steps *without* bumping it ships copy that only people who have
 *    never opened the tour will ever see. The closing step promises the button
 *    starts glowing when something new lands; the bump is that promise.
 *
 * Nothing here opens itself. The button is the only way in — see the comment on
 * `TOUR_REPLAY_EVENT` for why.
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
 * A release is announced as one story — everybody gets every step that applies to
 * their role, including steps from earlier releases. If the script ever gets too
 * long, delete steps from it rather than hiding them from some viewers.
 */

import { useEffect, useState } from 'react';

// Covers both boards and the new way in, which is why it supersedes the shell
// redesign's own string rather than extending it: people who already walked the
// shell tour have still seen neither dashboard nor this button.
export const TOUR_VERSION = '2026-08-dashboards-r1';
export const TOUR_STORAGE_KEY = 'whatsNewTour';

/**
 * Opening the tour. It is **never** shown automatically — the only way in is the
 * "Notice some changes?" button on the dashboard header, which pulses until it
 * has been used. Landing straight in a modal overlay on login is the thing
 * everybody clicks past without reading; a button that asks for attention lets
 * someone open it at the moment they actually wonder what moved.
 *
 * Window events rather than a context: the publishers and subscribers are one
 * button and one overlay, so a provider wrapping the whole app would be plumbing
 * for its own sake.
 */
export const TOUR_REPLAY_EVENT = 'whatsnew:replay';

/** Fired once the tour has been completed or skipped, to stop the pulse. */
export const TOUR_SEEN_EVENT = 'whatsnew:seen';

export const replayWhatsNewTour = () => {
  window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
};

const readSeenVersion = () => {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY);
  } catch {
    // Private mode / storage disabled. Counted as seen: a dismissal can't be
    // remembered here, and the alternative is a button that pulses for attention
    // on every page load forever.
    return TOUR_VERSION;
  }
};

/** Versioned, not boolean, so the next redesign only has to bump TOUR_VERSION. */
export const hasSeenWhatsNew = () => readSeenVersion() === TOUR_VERSION;

export const markWhatsNewSeen = () => {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, TOUR_VERSION);
  } catch {
    /* nothing we can do, and not worth surfacing to the user */
  }
  window.dispatchEvent(new Event(TOUR_SEEN_EVENT));
};

/**
 * Whether this viewer has already been through the current tour — what decides
 * whether the dashboard button pulses. Subscribed to the event rather than just
 * reading storage once, so finishing the tour stops the pulse immediately instead
 * of on the next page load.
 */
export const useWhatsNewSeen = () => {
  const [seen, setSeen] = useState(hasSeenWhatsNew);

  useEffect(() => {
    const onSeen = () => setSeen(true);
    window.addEventListener(TOUR_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(TOUR_SEEN_EVENT, onSeen);
  }, []);

  return seen;
};

export const WHATS_NEW_STEPS = [
  {
    id: 'intro',
    title: 'Task Manager has a new look',
    body: 'Same features, tidier shell — and a dashboard built for your role. A few controls moved; here is where they went.',
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
  //
  // Two variants of the SAME control, split by role rather than one shared step
  // plus a role-specific one — a control must only be spotlighted once per tour,
  // and an intern was getting the switcher twice with overlapping copy.
  // Whenever a step's copy needs to differ by role, split it like this and give
  // every variant a `roles`; never leave one un-scoped as the "default", or the
  // un-scoped one shows up for the role that already has its own.
  {
    id: 'workspace-switcher',
    roles: ['admin', 'mentor', 'leadership'],
    target: '[data-tour="workspace-switcher"]',
    title: 'Switching workspace changes everything below it',
    body: 'Pick a workspace here and the app follows — tickets, dailies, and every number on the dashboard. One workspace at a time, always the one named here.',
    placement: 'right',
  },
  {
    id: 'workspace-switcher-intern',
    roles: ['intern'],
    target: '[data-tour="workspace-switcher"]',
    title: 'Half your dashboard follows this',
    body: 'Tickets, workload and standup belong to the workspace named here and change when you switch. Attendance, your placement and your evaluations are programme-wide — they stay the same in every workspace.',
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

  // The intern dashboard, card by card. Same shape as the admin block above: all
  // intern-only, all anchored to elements that exist only on /dashboard, so on any
  // other page these drop out on their own.
  //
  // This is a bigger change for interns than the shell was — /dashboard used to BE
  // their ticket list — so the first step says that outright before walking the
  // cards.
  // No target on purpose: it reads as a section title before the card-by-card
  // walk, and the page area it would otherwise point at is already spotlighted by
  // `full-bleed` above — the same control twice in one tour is repetition, not
  // emphasis.
  {
    id: 'intern-dashboard',
    roles: ['intern'],
    title: 'Your dashboard is new',
    body: 'It used to be your ticket list. It is now your day at a glance — attendance, workload, standup, what to work on next, and where your placement stands. Here is each part.',
  },
  {
    id: 'intern-dashboard-attendance',
    roles: ['intern'],
    target: '[data-tour="intern-dashboard-attendance"]',
    title: 'Check in without leaving this page',
    body: 'The 07:00–11:00 check-in, your current streak and how this week is going. Attendance in the sidebar still has the full calendar and the cancel option.',
  },
  {
    id: 'intern-dashboard-workload',
    roles: ['intern'],
    target: '[data-tour="intern-dashboard-workload"]',
    title: 'Your open work, two ways',
    body: 'Switch between the bar and the breakdown with the toggle — your choice is remembered. Clicking the card opens your tickets.',
  },
  {
    id: 'intern-dashboard-standup',
    roles: ['intern'],
    target: '[data-tour="intern-dashboard-standup"]',
    title: 'Today’s note, shortened if it is long',
    body: 'A long note is trimmed here with an AI summary a click away, and you can edit today’s entry without opening the standup board.',
  },
  {
    id: 'intern-dashboard-tickets',
    roles: ['intern'],
    target: '[data-tour="intern-dashboard-tickets"]',
    title: 'Start here tells you what to pick up',
    body: 'Overdue, blocked and critical work sorts to the top. My Tickets has left the sidebar — “View all” opens the ticket list already filtered to you.',
  },
  {
    id: 'intern-dashboard-pipeline',
    roles: ['intern'],
    target: '[data-tour="intern-dashboard-pipeline"]',
    title: 'You can now see your own progress',
    body: 'Where your recommendation stands, and your evaluation scores below it. Both are new to you — the written notes behind them stay with your mentor.',
  },
];
