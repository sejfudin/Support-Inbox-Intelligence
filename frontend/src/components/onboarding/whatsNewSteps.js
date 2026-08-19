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
 * **The fields a step can carry:**
 *
 * - `title`, `body` — the copy. The title is upper-cased by the overlay, so write it
 *   in sentence case. Keep the body to a sentence or two: this is read standing up,
 *   over a dimmed app, and a paragraph gets skipped rather than shortened.
 * - `target` — a `[data-tour]` selector to spotlight. With none, the card is centred
 *   and reads as a plain notice. A target that spans the whole content column is
 *   allowed but costs something: the card is wider than the sidebar, so there is
 *   nowhere left to park it that is not over the thing it describes. The overlay
 *   then centres the card on the target and puts a scrim behind it (see `placeCard`),
 *   which reads as a panel rather than as copy on the dim. Point at a control where
 *   one carries the same meaning; spotlight the whole region only when the region
 *   *is* the subject, as the ticket board is.
 * - `route` — a path to open before the step is read, for a step whose subject *is*
 *   a page. Must be a route `SidebarLayout` serves, or the overlay unmounts
 *   mid-walkthrough. See the navigation effect in `WhatsNewTour`. A route the viewer
 *   would be *redirected off* counts as not served — check what guards it.
 * - `needsWorkspace` — drop the step for a viewer with no active workspace. Only for
 *   routes behind `WorkspaceGuard`, which bounces those viewers to
 *   `/create-workspace` — outside `SidebarLayout`, so the tour would unmount there
 *   and never mark itself seen. See the second paragraph below.
 * - `needsAttendance` — drop the step for an intern already on a project. They owe
 *   no attendance from `placedAt`, so `MyAttendancePage` withdraws the request panel
 *   and any copy about asking for days off is false for them. Costs the overlay a
 *   `useMyAttendance` read, so only put it on a step that genuinely needs it.
 * - `swatches` — paints the eleven `THEMES` gradients under the copy. Specific to
 *   the accents step; showing them beats claiming they exist.
 * - `placement` — the preferred side for the card. A hint, not a guarantee: the
 *   overlay overrides it when that side would cover the target.
 * - `roles` — see below.
 *
 * **`roles` decides who sees a step; `needsWorkspace` and `needsAttendance` are the
 * only other things that can drop one.** Steps are never dropped for a missing target: the count a
 * viewer sees is exactly the number of entries below that apply to them, and a target
 * that has not rendered yet (every dashboard card is behind a query) is waited for,
 * then falls back to a centred card. So if you add a step for a role, that role
 * *will* walk through it — which also means a step whose element genuinely never
 * exists for that role is a scripting bug here, not something the runtime will
 * quietly paper over.
 *
 * `needsWorkspace` is the first exception, and it is not about copy or elements — it is
 * about the tour surviving its own navigation. A step routing behind
 * `WorkspaceGuard` sends a viewer with no `workspaceId` to `/create-workspace`,
 * which `SidebarLayout` does not serve. The overlay unmounts, `markWhatsNewSeen`
 * never runs, and the next load auto-opens the same tour into the same bounce —
 * an announcement that can never be finished or dismissed. Dropping the step is the
 * lesser loss: that viewer has no board to be shown. This is not a role check —
 * interns between workspaces, mentors without one and admins in Global admin mode
 * all sit in this state.
 *
 * `needsAttendance` is the second, and this one *is* about the copy as much as the
 * element. An intern on a project has no request panel to spotlight and nothing to
 * request — telling them to ask for remote days "here" is wrong on both counts, and
 * pointing the step at the notice that replaces the panel would spotlight text
 * saying the opposite. Both flags share one rule: a step is dropped only when the
 * viewer cannot reach or cannot use what it describes, never to shorten the tour.
 *
 * `roles` narrows a step to specific platform roles when the *copy* only applies
 * to them, which is not the same thing as the element existing.
 *
 * A release is announced as one story — everybody gets every step that applies to
 * their role, including steps from earlier releases. If the script ever gets too
 * long, delete steps from it rather than hiding them from some viewers.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { resolveUserId } from '@/helpers/userIdentity';

// Bump history, newest last. Each entry is the reason the re-announcement was
// worth interrupting people for — a bump with no reason here is a nag.
//
// - r1/r2 (shell redesign): the app shell, then a re-announcement because the way
//   back in moved to the sidebar footer and r1 had shipped a truncated walkthrough.
// - `2026-08-my-progress`: interns gained a page, and with it the written notes on
//   their evaluations — which the previous tour had told them stayed with their
//   mentor. Leaving the old string would have shipped a correction that only
//   first-time viewers ever saw.
// - `2026-08-redesign-and-requests` (this one): the component-library redesign, the
//   eleven accents, the new Settings page, and preferences moving off the browser
//   onto the account. It also clears a genuine backlog — time-away requests, the
//   absence queue, staffing requests, the positions catalog, the placement start
//   date and the new notification triggers all shipped without anyone bumping this
//   string, so they have never been announced to a single user.
//
//   This is also the first bump to spend more of its length deleting than adding,
//   and the trade the note above prescribes applied for real. Gone: the collapse
//   control, the bell's location and the workspace switcher, each announced across
//   three consecutive releases, where a fourth telling is a nag rather than news;
//   both dashboard walks, which the previous two releases already covered card by
//   card; the archive/backlog sort, too small to spend a step on; and the
//   current-password change, which is a security fix people meet when they need it
//   rather than something to walk them through. The bell keeps a step, but about
//   what it now carries instead of where it sits. What that buys is a tour short
//   enough to finish, on the surfaces nobody has been shown even once.
export const TOUR_VERSION = '2026-08-redesign-and-requests';

/**
 * Master switch for the what's-new tour — **temporarily off**.
 *
 * The tour is a full-screen overlay that opens itself on first load after a version
 * bump, which makes the app undrivable by automated tests: the scrim swallows every
 * click until someone walks the script to the end. Turned off so the automation suite
 * can run.
 *
 * TEMPORARY — turn this back to `true` before the production release. Nothing else
 * needs reverting: this flag gates both ways in (the auto-open in `WhatsNewTour` and
 * the sidebar's "Notice some changes?" button), the steps and anchors are all still
 * here, and the per-account seen-state is untouched, so flipping it back re-announces
 * `TOUR_VERSION` to everyone exactly once as designed.
 */
export const TOUR_ENABLED = false;

/**
 * Opening the tour. Two ways in, and they answer different needs:
 *
 * 1. **Automatically, once, on the first load after a `TOUR_VERSION` bump.** A
 *    redesign that nobody is told about generates support questions instead of
 *    discovery, and the people most likely to be confused are the least likely to go
 *    hunting for a button. Gated on the versioned seen-state, so it interrupts a
 *    given account exactly once per release and never again — on any browser.
 * 2. **The "Notice some changes?" button** in the sidebar footer, just above the
 *    account row, which pulses until the tour has been used. This is the way back in
 *    for anyone who escaped the automatic showing without reading it, or who only
 *    wonders what moved a week later.
 *
 * Window events rather than a context: the publishers and subscribers are one button
 * and one overlay, so a provider wrapping the whole app would be plumbing for its own
 * sake.
 */
export const TOUR_REPLAY_EVENT = 'whatsnew:replay';

export const replayWhatsNewTour = () => {
  if (!TOUR_ENABLED) return;
  window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
};

/**
 * Where "this viewer has finished this tour" is remembered — **one key per account**,
 * not one per browser.
 *
 * It used to be a single `whatsNewTour` key, which is a real bug on a shared machine:
 * sign-out clears only the tokens (`clearAuth` in `queries/auth.js`), so the next
 * person to sign in inherited the previous person's "seen" state and never got the
 * tour at all. Namespacing by account id is the whole fix.
 *
 * Namespacing rather than clearing on sign-out, because clearing would re-show the
 * tour to the *same* person every time they signed back in — a nag — and would do
 * nothing for a session that simply expires instead of being logged out.
 *
 * No migration: the old un-namespaced key is now never read, so every account reads as
 * "not seen yet" once. That is what this release wants anyway.
 *
 * **Known limit, accepted:** this is per browser, so someone who reads the tour in
 * Safari meets it again in Chrome. Putting it on the user record alongside
 * `preferences` would fix that, and it was built and then reverted — it cost a server
 * constant, a model field, a validator branch, a sync-table row and a hydration gate,
 * which is too much machinery for one boolean-ish flag. If a second thing ever needs
 * to follow the account like this, do it then and carry this along with it.
 *
 * Not exported: every read and write lives in this module, and the two consumers go
 * through `useWhatsNewSeen` / `markWhatsNewSeen`. Keep it that way — a second module
 * touching these keys directly is how the button and the overlay end up disagreeing.
 */
const tourStorageKey = (userId) => `whatsNewTour:${userId}`;

/** Fired once the tour has been finished (or escaped out of), to stop the pulse. */
const TOUR_SEEN_EVENT = 'whatsnew:seen';

const readSeenVersion = (userId) => {
  try {
    return window.localStorage.getItem(tourStorageKey(userId));
  } catch {
    // Private mode / storage disabled. Counted as seen: a dismissal can't be
    // remembered here, and the alternative is a button that pulses for attention on
    // every page load forever.
    return TOUR_VERSION;
  }
};

/**
 * Versioned, not boolean, so the next release only has to bump `TOUR_VERSION`.
 *
 * No id yet (the `/me` fetch is still in flight) counts as seen: it keeps the button
 * from pulsing for a frame before we know who is looking, and the overlay's auto-open
 * is gated on having a user anyway.
 */
const hasSeenWhatsNew = (userId) => !userId || readSeenVersion(userId) === TOUR_VERSION;

export const markWhatsNewSeen = (userId) => {
  if (!userId) return;
  try {
    window.localStorage.setItem(tourStorageKey(userId), TOUR_VERSION);
  } catch {
    /* nothing we can do, and not worth surfacing to the user */
  }
  window.dispatchEvent(new Event(TOUR_SEEN_EVENT));
};

/**
 * Whether this viewer has already been through the current tour — what decides
 * whether the sidebar button pulses. Subscribed to the event rather than just reading
 * storage once, so finishing the tour stops the pulse immediately instead of on the
 * next page load.
 */
export const useWhatsNewSeen = () => {
  // Read here rather than taken as a prop: both consumers sit inside the provider, and
  // a hook that cannot be handed the wrong id is one fewer way to reintroduce the
  // shared-browser bug the key namespacing above fixes.
  const { user } = useAuth();
  const userId = resolveUserId(user);

  const [seen, setSeen] = useState(() => hasSeenWhatsNew(userId));

  // Re-read on the id, not just once: the same mounted shell can go from no user to a
  // user (the `/me` fetch resolving), and on a shared browser from one person to
  // another without a remount.
  useEffect(() => {
    setSeen(hasSeenWhatsNew(userId));
  }, [userId]);

  useEffect(() => {
    const onSeen = () => setSeen(true);
    window.addEventListener(TOUR_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(TOUR_SEEN_EVENT, onSeen);
  }, []);

  return seen;
};

export const WHATS_NEW_STEPS = [
  {
    id: 'overhaul',
    title: 'New UI overhaul',
    body: 'Every button, badge, table and input rebuilt on one shared set. Same features, same places — it just reads as one app now.',
  },
  // The Settings walk. One route, then a section at a time — the reader is standing
  // on the page while it is described, so "under Accessibility" means the card they
  // are looking at, not somewhere to go and find later.
  //
  // Only the opener carries the `route`: the rest are already there, and re-navigating
  // on every step would reset the page's scroll out from under the spotlight.
  //
  // The opener is deliberately un-targeted. Its subject is the page as a whole, and a
  // spotlight on any one card would crop the thing it is introducing — so the whole
  // page shows through the dim, and the sections get their own steps below it.
  {
    id: 'settings',
    route: '/settings',
    title: 'Settings',
    body: 'A page of your own, and it opens from your name in the sidebar. Here is what is on it.',
  },
  // `swatches` paints the real `THEMES` gradients under the copy — eleven squares say
  // "eleven palettes" faster than the sentence does. Pointed at the Appearance card
  // rather than the account menu, so the control that changes them is under the
  // reader's eyes while they read about them.
  {
    id: 'appearance',
    target: '[data-tour="settings-appearance"]',
    swatches: true,
    title: 'New themes!',
    body: 'Eleven accents, in light or dark, plus a compact row density.',
    placement: 'right',
  },
  {
    id: 'accessibility',
    target: '[data-tour="settings-accessibility"]',
    title: 'Contrast, colour vision, motion',
    body: 'Plus a text size control. Red text that was unreadable on dark is repaired everywhere, not only in high contrast.',
    placement: 'right',
  },
  {
    id: 'defaults',
    target: '[data-tour="settings-defaults"]',
    title: 'What the app opens on',
    body: 'Your landing page, list or board, whether Tickets arrives filtered to you, and how board cards sort.',
    placement: 'right',
  },
  {
    id: 'notifications-new',
    target: '[data-tour="settings-notifications"]',
    title: 'More notifications',
    body: 'Programme changes, and a 10:30 nudge when a check-in or daily is missing. Mute any group right here.',
    placement: 'right',
  },
  // The one row worth its own step: it is the only setting on the page that needs a
  // browser permission, so it is the only one that does nothing until it is clicked
  // deliberately. Pointed at the row rather than the section above, which the
  // previous step already spotlights.
  {
    id: 'desktop-notifications',
    target: '[data-tour="settings-desktop-notifications"]',
    title: 'Keep forgetting check-ins?',
    body: 'Or just have FOMO? Switch on desktop notifications and you get a banner outside the browser, even when this tab is in the background.',
    placement: 'right',
  },
  {
    id: 'preferences-sync',
    title: 'All of it follows your account',
    body: 'Every setting on this page used to be per-browser, lost in a private window. Now it travels with you.',
  },
  // `?view=board` opens the board without writing the view preference — see the
  // comment on `viewParam` in `TicketPage`. So the tour can show someone the board
  // without quietly changing what Tickets opens on for them afterwards.
  {
    id: 'tickets-board',
    route: '/tickets?view=board',
    needsWorkspace: true,
    target: '[data-tour="tickets-board"]',
    title: 'Tickets: list and board',
    body: 'Both screens rebuilt. Switch view from the header — and the board widens its columns when you collapse the sidebar.',
    placement: 'left',
  },

  // Intern-only.
  {
    id: 'nav-my-progress',
    roles: ['intern'],
    target: '[data-tour="nav-my-progress"]',
    title: 'My Progress',
    body: 'Your evaluations and scores with your mentor’s written notes, your readiness, and every project you have been put forward for.',
    placement: 'right',
  },
  {
    id: 'attendance-intern',
    roles: ['intern'],
    route: '/my-attendance',
    needsAttendance: true,
    target: '[data-tour="attendance-requests"]',
    title: 'Remote work?',
    body: 'Ask for remote days, vacation, a religious holiday or a sick day here. An admin decides each one.',
    placement: 'left',
  },

  // Admin-only, in sidebar order. These stay pointed at their nav row rather than
  // navigating: the news is that the row exists, and four page loads in a row would
  // turn the tail of the tour into a slideshow.
  {
    id: 'nav-attendance-admin',
    roles: ['admin'],
    target: '[data-tour="nav-attendance"]',
    title: 'Attendance roster',
    body: 'Every intern by month. A placement start date now ends their attendance obligation from that day.',
    placement: 'right',
  },
  {
    id: 'nav-absence-requests',
    roles: ['admin'],
    target: '[data-tour="nav-admin-absence-requests"]',
    title: 'Absence requests',
    body: 'Remote work, vacation, holidays and sick days in one queue. The dot means something is waiting. Limits live on their own tab.',
    placement: 'right',
  },
  {
    id: 'nav-staffing-requests',
    roles: ['admin'],
    target: '[data-tour="nav-admin-staffing-requests"]',
    title: 'Staffing requests',
    body: 'Leadership records demand for a project. You put interns forward seat by seat, then close it fulfilled or declined.',
    placement: 'right',
  },
  {
    id: 'nav-platform-management',
    roles: ['admin'],
    target: '[data-tour="nav-admin-platform-management"]',
    title: 'Positions catalog',
    body: 'Positions are their own list now, separate from technologies. New projects also carry a client or internal type.',
    placement: 'right',
  },
  {
    id: 'nav-specialization',
    roles: ['admin'],
    target: '[data-tour="nav-specialization"]',
    title: 'Specializations',
    body: 'Confirm one of an intern’s declared positions as their focus and pair them with a 1-on-1 mentor, in one action.',
    placement: 'right',
  },

  // Un-targeted: the panel sits on an intern's profile Overview, which an admin
  // reaches from All Users and a mentor from My Interns. No single nav row is the
  // way in for both roles.
  {
    id: 'cv-summary',
    roles: ['admin', 'mentor'],
    title: 'AI CV summary',
    body: 'On an intern’s profile: a description of what their CV says. Never a score, a ranking or a verdict on fit. The intern never sees it.',
  },
];
