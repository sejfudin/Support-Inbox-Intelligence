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
import { markWhatsNewSeenOnAccount } from '@/api/onboardingTour';
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
// - `2026-08-redesign-and-requests`: the component-library redesign, the
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
// - `2026-08-profile-pictures`: everyone can set a profile picture, and it
//   stands in for their initials everywhere they appear. One step, and a bump for it,
//   because the feature is opt-in and invisible until somebody uses it — an avatar
//   nobody knows they can change is an avatar that stays initials forever. It adds
//   nothing else and deletes nothing: the previous entry's steps are still the first
//   telling of most of what they cover.
// - `2026-08-settings-cleanup`: Density, Colour vision and Motion were
//   removed from Settings. Same reasoning as `2026-08-my-progress` — the `appearance`
//   and `accessibility` steps named all three ("plus a compact row density",
//   "Contrast, colour vision, motion"), and leaving that copy would have shipped a
//   correction only first-time viewers ever see. No new step; the two edited ones
//   just stop claiming settings that no longer exist.
// - `2026-08-ai-skills`: the intern page is Position & Skills now, and the
//   catalog has a second half — coding agents, assistant IDEs, LLM APIs — with its own
//   search box beside the technology one. One intern step, and a bump for it, for the
//   same reason as the avatars: a search box nobody knows about is a list that stays
//   empty, and a mentor cannot assess an AI skill that was never declared. Deletes
//   nothing — the two entries above are a step and a correction, and this neither
//   repeats nor retires either.
// - `2026-09-appearance-cleanup` (this one): "Text & UI size" is gone from Settings
//   (it scaled the app with `zoom`, which broke dropdown positioning), and Leadership's
//   own Settings no longer offers an accent — that surface is brand-locked, so the
//   picker never did anything there. Same reasoning as `2026-08-settings-cleanup`: the
//   `accessibility` step's title named "text size", and leaving it would ship a
//   correction only first-time viewers ever see. No new step; one edited title.
export const TOUR_VERSION = '2026-09-appearance-cleanup';

/**
 * Master switch for the what's-new tour. **On.**
 *
 * It gates both ways in — the auto-open in `WhatsNewTour` and the sidebar's "Notice
 * some changes?" button — so `false` here means the overlay cannot mount at all and
 * the button renders nothing, rather than a control that does nothing.
 *
 * **If you are driving the app and the screen is covered, this is why.** The tour is
 * a full-screen overlay whose scrim swallows every click until the script is walked
 * to the end, so an automated run against an account that has not seen the current
 * `TOUR_VERSION` will stall on it. Two ways past it, in order of preference:
 *
 * 1. **Drive as an account that has already seen it.** Since the seen-state moved to
 *    the user record (see `tourStorageKey` below) this survives a fresh browser
 *    profile, so it is a property of the fixture rather than of the machine.
 * 2. **Flip this constant to `false` for the run.** Deliberately a plain constant and
 *    not an env var, a query param or a storage key: each of those costs something
 *    outside this file — a row in `.env.example` and the workflows doc, a param that
 *    leaks through a shared link, or app state a real user could land in — to replace
 *    an edit that takes one line and is visible in the diff.
 */
export const TOUR_ENABLED = true;

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
 * Where "this viewer has finished this tour" is remembered: **on the user record**,
 * with a per-account `localStorage` key as the backstop underneath it.
 *
 * The server field (`User.whatsNewSeenVersion`, written through
 * `PATCH /api/users/me/whats-new-seen`) is the source of truth, and it is what makes
 * reading the tour in Chrome mean not meeting it again in Safari, on a phone, or on
 * a fresh machine. It arrives on the `/auth/me` payload the shell already waits for,
 * so it costs no extra request and no hydration gate of its own — `getMe` spreads the
 * whole user document, and the tour was already gated on having a user.
 *
 * An earlier attempt at this was built and reverted for being too much machinery: it
 * went through the `preferences` subdocument, which meant a server constant, an enum
 * branch in a validator whose whole contract is "a value from this table", a row in
 * the `ThemeConfigContext` sync table, and a gate to wait for the hydration. A
 * top-level field beside `staffingRequestsLastSeenAt` — a marker the app writes, not
 * a setting the user picks — needs none of those. That is the whole difference.
 *
 * **The local key stays, and is not a leftover.** It is written first, synchronously,
 * on every finish, and it is what the reads fall back to. Three things depend on it:
 *
 * - A failed or offline PATCH does not turn into a tour that reopens on every load.
 *   Nagging is the one failure mode this feature cannot have, and it is worse than
 *   someone reading the tour twice.
 * - The button's pulse is correct on the frame the tour is finished, rather than
 *   after a round trip.
 * - Private mode / storage disabled still degrades to "counted as seen" via
 *   `readSeenVersion`'s `catch`, unchanged.
 *
 * **Where the two disagree, seen wins**: either source saying "read it" means it was
 * read. So an account marked seen on the server, opened in a browser with no local
 * copy, is correctly not re-shown — that is the feature working, not a stale read.
 *
 * The local key is namespaced by account id and that still matters. Sign-out clears
 * only the tokens (`clearAuth` in `queries/auth.js`), so a single `whatsNewTour` key
 * on a shared machine let the next person inherit the previous person's "seen" state
 * and never get the tour at all. Namespacing rather than clearing on sign-out,
 * because clearing would re-show the tour to the *same* person every time they signed
 * back in — a nag — and would do nothing for a session that simply expires.
 *
 * Versioned rather than boolean throughout, server included, so the release mechanism
 * at the top of this file survives: bump `TOUR_VERSION`, and everyone is re-announced
 * to exactly once. A boolean `hasOnboarded` would ship the tour once ever and quietly
 * retire the channel the closing step promises.
 *
 * Not exported: every read and write lives in this module, and the two consumers go
 * through `useWhatsNewSeen` / `markWhatsNewSeen`. Keep it that way — a second module
 * touching these keys directly is how the button and the overlay end up disagreeing,
 * and now also how a component would end up learning that a request is involved.
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
 * Takes the whole user rather than an id, because the account's own answer is now a
 * field on it. Either source saying "seen" is enough — see the block above on why
 * seen wins a disagreement.
 *
 * No user yet (the `/me` fetch is still in flight) counts as seen: it keeps the button
 * from pulsing for a frame before we know who is looking, and the overlay's auto-open
 * is gated on having a user anyway. That gate is also what removes any need for a
 * separate one here — by the time there is a user to read, the server's answer has
 * arrived on the same payload.
 */
const hasSeenWhatsNew = (user) => {
  const userId = resolveUserId(user);
  if (!userId) return true;
  if (user?.whatsNewSeenVersion === TOUR_VERSION) return true;
  return readSeenVersion(userId) === TOUR_VERSION;
};

/**
 * Local first and synchronously, then the account.
 *
 * The order is the point: the local write and the event are what stop the pulse on
 * this frame and what keep the tour from reopening if the request never lands, so
 * neither waits on a round trip. The PATCH is fire-and-forget for the same reason —
 * there is nothing to do with a failure that the local copy has not already covered,
 * and a toast saying "we could not remember that you read this" helps nobody.
 *
 * The one case it leaves open is deliberate: an account that finishes the tour while
 * offline and never comes back on this browser meets it once more elsewhere. That is
 * the harmless direction to be wrong in.
 */
export const markWhatsNewSeen = (userId) => {
  if (!userId) return;
  try {
    window.localStorage.setItem(tourStorageKey(userId), TOUR_VERSION);
  } catch {
    /* nothing we can do, and not worth surfacing to the user */
  }
  window.dispatchEvent(new Event(TOUR_SEEN_EVENT));

  markWhatsNewSeenOnAccount(TOUR_VERSION).catch(() => {
    /* the local copy already answered; see the note above */
  });
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
  const accountSeenVersion = user?.whatsNewSeenVersion ?? null;

  const [seen, setSeen] = useState(() => hasSeenWhatsNew(user));

  // Re-read on the id *and* on the account's stored version, not just once: the same
  // mounted shell can go from no user to a user (the `/me` fetch resolving), and on a
  // shared browser from one person to another without a remount. The version is in
  // the deps because a `/me` refetch can change it under the same id — a second
  // browser finishing the tour, say — and the button should go quiet without a reload.
  useEffect(() => {
    setSeen(hasSeenWhatsNew(user));
    // `user` itself is not a dep: `AuthContext` hands back a new object on every
    // refetch, which would re-run this on every one of them for nothing. The two
    // fields that can actually change the answer are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, accountSeenVersion]);

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
    body: 'Eleven accents, in light or dark.',
    placement: 'right',
  },
  {
    id: 'accessibility',
    target: '[data-tour="settings-accessibility"]',
    title: 'Contrast',
    body: 'Red text that was unreadable on dark is repaired everywhere, not only in high contrast.',
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
  // Sits at the end of the account-level run, before the walkthrough moves out into
  // the workspace — a picture is the last thing on this page that is *yours*.
  //
  // `roles` excludes leadership, and that is not a copy judgement: `/profile` renders
  // `<Navigate to="/programme">` for them, and `/programme` is served by the
  // leadership layout rather than `SidebarLayout`. Routing them here would unmount the
  // overlay mid-tour, so `markWhatsNewSeen` would never run and the next load would
  // re-open the same tour into the same bounce — the failure `needsWorkspace` exists
  // to prevent, arrived at through a role instead. Leadership genuinely has no profile
  // page to be shown; when they get one, drop the filter.
  //
  // Spotlights the picture at rest, where the camera is not yet showing, so the copy
  // has to name the way in rather than say "here".
  {
    id: 'profile-picture',
    roles: ['admin', 'mentor', 'intern'],
    route: '/profile',
    target: '[data-tour="profile-avatar"]',
    title: 'Profile pictures',
    body: 'Set yours under Edit profile, and it follows you everywhere you appear — dashboards, comments, standups, rosters. Initials stand in until you do.',
    placement: 'right',
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
    id: 'ai-skills',
    roles: ['intern'],
    target: '[data-tour="nav-my-technologies"]',
    title: 'Position & Skills',
    body: 'Your technologies live here, and now AI skills too — Claude Code, Cursor, Copilot, MCP and the rest, in their own search box. Declare what you use; your mentor assesses these the same way.',
    placement: 'right',
  },
  {
    id: 'attendance-intern',
    roles: ['intern'],
    route: '/my-attendance',
    needsAttendance: true,
    target: '[data-tour="absence-requests"]',
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
