/**
 * The script for how we announce what's new. This is the mechanism for it — the
 * tour's closing step tells people so out loud, so releases are expected to keep
 * arriving through here rather than through a changelog nobody opens.
 *
 * **Shipping a release through this is two steps, and both are required:**
 *
 * 1. Add or edit the steps below.
 * 2. Bump `TOUR_VERSION`. This is what makes the sidebar's "What's new" button
 *    glow again for everyone, exactly once, and what puts the NEW pills back on
 *    this release's nav rows — the string is the stored seen-value, so a new one
 *    puts every viewer back into "not seen yet". Editing steps *without* bumping it
 *    ships copy that only people who have never opened the tour will ever see. The
 *    closing step promises the button starts glowing when something new lands; the
 *    bump is that promise.
 *
 * Nothing here opens itself, and that is the whole design: the glow asks, the click
 * answers. See the comment on `TOUR_REPLAY_EVENT`.
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
 * - `swatches` — paints the eleven `THEMES` gradients under the copy, for a step
 *   announcing accents: showing them beats claiming they exist. **No step in the
 *   current script uses it** — the accents step was deleted with the rest of the
 *   2026-08 release — so do not go looking for the example. Kept because it is part of
 *   this script's vocabulary rather than code of its own: the overlay spends one
 *   truthy check on it, and the next release to retune the palettes wants it back.
 * - `placement` — the preferred side for the card. A hint, not a guarantee: the
 *   overlay overrides it when that side would cover the target.
 * - `navRoute` — the sidebar route this step announces, for a step whose subject *is*
 *   a nav row. Paired with `since` it also paints the row's NEW pill; see
 *   `useNewFeatureRoutes`. Must be a nav item's `to` in `AppSidebar` verbatim, since
 *   that is what it is matched against.
 * - `since` — the `TOUR_VERSION` string this step shipped in. Read for one thing only:
 *   a step whose `since` is the *current* version badges its `navRoute` row as NEW.
 *   A step with no `since`, or one from an older release, never badges — which is why
 *   a bump needs no cleanup pass over the steps below. Set it on what you add, leave
 *   the rest alone.
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
 * never runs, and the glow the viewer just answered is still glowing — an
 * announcement that can never be finished or dismissed. Dropping the step is the
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

import { useEffect, useMemo, useState } from 'react';
import { markWhatsNewSeenOnAccount } from '@/api/onboardingTour';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_ONBOARDING_HIGHLIGHT,
  isValidOnboardingHighlight,
  ONBOARDING_HIGHLIGHT_STORAGE_KEY,
} from '@/helpers/onboardingTour';
import { resolveUserId } from '@/helpers/userIdentity';
import { readStoredPreference } from '@/hooks/useStoredPreference';
import { subscribeToPreference } from '@/lib/preferenceSync';

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
// - `2026-09-appearance-cleanup`: "Text & UI size" is gone from Settings
//   (it scaled the app with `zoom`, which broke dropdown positioning), and Leadership's
//   own Settings no longer offers an accent — that surface is brand-locked, so the
//   picker never did anything there. Same reasoning as `2026-08-settings-cleanup`: the
//   `accessibility` step's title named "text size", and leaving it would ship a
//   correction only first-time viewers ever see. No new step; one edited title — a
//   step the entry below then deleted along with the rest of that script, so do not
//   go looking for it.
// - `2026-09-sprints-and-drafts` (this one): sprints — planning on the board,
//   optional dates with a two-week default, the successor sprint that grows itself and
//   carries the unfinished work across, and the AI recap on the Summary tab — plus the
//   two things the ticket board gained (a draft that survives a closed modal, and bulk
//   status/archive on a selection) and the collapsible sidebar sections from #312,
//   which shipped opt-in and default-off and so are invisible to everybody who has not
//   already gone looking in Settings. None of it has been announced to anybody. The
//   list came out of `docs/TEAM_HANDBOOK.md`'s diff since the last bump, which is the
//   cheapest way to find what shipped without a step: the handbook is updated per
//   change and this script is not.
//
//   Two steps in it are not about a feature. The opener says out loud that the tour
//   stopped opening itself, because for anyone who resented the old one that *is* the
//   news — and it is what makes the glow legible as an offer. And the mentor dashboard
//   step pays a debt from #307: mentors were given a real dashboard in August and no
//   script ever mentioned it.
//
//   Three things shipped in this window and are deliberately **not** in the script:
//   the atomic task-number counter and optimistic board drag-and-drop (#318) and the
//   Blocked-status fix's plumbing, which are repairs — people meet a repair when they
//   need it, the way the current-password change was handled two entries above; the
//   Settings controls #323 *removed*, since no step claims them any more; and the
//   leadership Settings page (#319), which this channel cannot reach at all —
//   leadership is served outside `SidebarLayout`, so the What's new button does not
//   render for them and every route here would bounce them. If leadership is ever to
//   be announced to, it needs its own entry point on that surface.
//
//   **It also deletes every step that came before it**, which is a change of policy
//   and not a trim. The note above prescribes announcing a release "as one story",
//   earlier releases included, and that was right while the tour opened itself: a
//   viewer met it once, unprompted, and it had to make sense of a whole shell they had
//   never been walked through.
//
//   Nothing opens itself now (see `TOUR_REPLAY_EVENT`), and that inverts the reasoning.
//   The tour is only ever on screen because somebody clicked a button that says
//   What's new, so the question it has to answer is "what changed *recently*" — not
//   "what has this app ever done". Twenty-four steps of accumulated history is the
//   wrong answer to that question, and it is also the answer nobody finishes. So the
//   script is one release at a time from here on, and a bump means: delete the last
//   one, write this one.
//
//   What that costs is real and worth naming: the 2026-08 steps were the only telling
//   several surfaces ever got — Settings, the accents, profile pictures, My Progress,
//   the absence queue, the positions catalog. Deleting them means a viewer who never
//   opened the old tour will not now be told about any of it here. They are in git,
//   and `docs/TEAM_HANDBOOK.md` is where a person who missed a release is supposed to
//   look; this channel is for what is new.
export const TOUR_VERSION = '2026-09-sprints-and-drafts';

/**
 * Master switch for the what's-new tour. **On.**
 *
 * It gates the only way in — the sidebar's "What's new" button — so `false` here means
 * the button renders nothing at all, rather than a control that does nothing. It also
 * silences the NEW pills, since the tour they point at cannot be opened.
 *
 * Deliberately a plain constant and not an env var, a query param or a storage key:
 * each of those costs something outside this file — a row in `.env.example` and the
 * workflows doc, a param that leaks through a shared link, or app state a real user
 * could land in — to replace an edit that takes one line and is visible in the diff.
 *
 * **An automated run no longer has to care about this.** The overlay used to open
 * itself on the first load after a bump and swallow every click until the script was
 * walked to the end, so a browser pass on a fresh account stalled on it and this
 * constant was the escape hatch. Nothing opens itself now: the tour is on screen only
 * because something clicked the button.
 */
export const TOUR_ENABLED = true;

/**
 * Opening the tour. **One way in: the "What's new" button** in the sidebar footer,
 * just above the account row.
 *
 * It used to be two. The overlay also opened itself on the first load after a
 * `TOUR_VERSION` bump, on the reasoning that the people most likely to be confused by
 * a redesign are the least likely to go hunting for a button. That reasoning is not
 * wrong, but the price was: every viewer, on a load they chose for some other purpose,
 * met a full-screen scrim that swallowed every click until they had walked the script
 * or found Skip. A release nobody asked to hear about is an interruption, and an
 * interruption is skipped rather than read — which loses the announcement *and* marks
 * it seen, so the one telling it got was the one nobody looked at.
 *
 * What replaces it is an invitation rather than a demand: the button glows while there
 * is something unread (`useWhatsNewHighlight`), the nav rows this release added carry a
 * NEW pill beside their label (`useNewFeatureRoutes`), and the tour opens when — and
 * only when — somebody clicks. Reading it stops both signals; so does escaping out of
 * it, because a person who opened it and left has answered the question the glow asks.
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
 * from glowing for a frame before we know who is looking. Nothing is lost by waiting —
 * the account's own answer arrives on the same `/me` payload as the user, so the first
 * read that can happen is already the right one rather than this browser's guess.
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

/**
 * Whether the "there is something here you have not read" signals should be showing:
 * the glow on the sidebar's What's new button, and the NEW pills beside the nav rows
 * this release added.
 *
 * Three answers ANDed together — is the tour shipped at all, has this viewer already
 * read the current one, and do they want to be told (Settings → Notifications →
 * "Highlight what's new"). Since nothing opens itself any more, this preference is the
 * whole of the opt-out: switching it off does not hide the tour, it stops the app
 * pointing at it, and the button stays exactly where it was for anyone who goes
 * looking.
 *
 * The preference is read synchronously in the state initialiser rather than through
 * `useStoredPreference`, which reads storage in an effect and so answers with the
 * default for one render. For a viewer who has switched the highlight off that render
 * would paint a glowing button and a NEW pill inside a nav row, then take both away on
 * the next frame — a flash, and one that shifts the nav row's layout as it goes.
 * Subscribed all the same, so flipping the switch in Settings quiets the sidebar
 * immediately instead of at the next reload.
 */
export const useWhatsNewHighlight = () => {
  const seen = useWhatsNewSeen();
  const [highlight, setHighlight] = useState(() =>
    readStoredPreference(
      ONBOARDING_HIGHLIGHT_STORAGE_KEY,
      DEFAULT_ONBOARDING_HIGHLIGHT,
      isValidOnboardingHighlight
    )
  );

  useEffect(
    () =>
      subscribeToPreference(ONBOARDING_HIGHLIGHT_STORAGE_KEY, (next) => {
        if (!isValidOnboardingHighlight(next)) return;
        setHighlight(next);
      }),
    []
  );

  return TOUR_ENABLED && !seen && highlight === 'on';
};

/**
 * Whether one step applies to a given viewer — the role narrowing plus the two
 * `needs*` escapes, in one place because two things ask the question. The overlay asks
 * it to build the list it walks; the sidebar button asks it to find out whether it has
 * anything to open at all, and the two disagreeing is exactly the bug where a button
 * glows for attention and then opens an empty tour.
 *
 * `onProject` defaults to `false` — "we do not know yet" — because the button asking
 * cannot know: `placedAt` lives behind a query the overlay only fires once it is open.
 * So the button can over-count by at most the `needsAttendance` steps, which is safe
 * as long as no release makes those a viewer's *whole* script. Don't write that
 * release; a tour whose every step can vanish on a query landing is a tour that can
 * open empty.
 */
export const stepAppliesTo = (step, { role, hasWorkspace, onProject = false }) => {
  if (step.roles && !step.roles.includes(role)) return false;
  if (step.needsWorkspace && !hasWorkspace) return false;
  if (step.needsAttendance && onProject) return false;
  return true;
};

export const WHATS_NEW_STEPS = [
  // ── `2026-09-sprints-and-drafts` ─────────────────────────────────────────────
  //
  // The whole script is this one release. Everything before it was deleted the day
  // this shipped — see the bump history above for why, and read that before adding
  // a step from an older release back in.
  //
  // Two steps here carry no `needs*` flag — the opener and the sidebar one at the end
  // — so a viewer with no workspace still gets a tour rather than nothing. That is a
  // property of this script and not a guarantee: `useHasWhatsNewSteps` is what keeps
  // the button from glowing at somebody a future script has nothing to show.

  // The opener, and the only step about the tour rather than about the app. It is here
  // because the thing most worth telling people is that this stopped being something
  // done *to* them: the previous version opened itself on the first load after every
  // release, over whatever they had come to the app to do. Saying so is also the only
  // way the glow gets understood as an offer rather than as a nag in waiting.
  //
  // Un-targeted (a centred card) and carries no `needs*` flag, so it opens the tour
  // for every viewer including one with no workspace, whose script is otherwise only
  // the sidebar step at the end.
  {
    id: 'we-heard-you',
    since: TOUR_VERSION,
    title: 'We heard you',
    body: 'Onboarding tours are tedious, and this one used to open itself on you. Not any more — nothing here will ever pop up again. The button in the sidebar glows when something ships, and you decide whether and when to read it. Like now.',
  },
  // The release's headline, and the only thing in it that added a page. Spotlights the
  // nav row rather than the board it routes to, because the row *is* the news for
  // anyone who has not noticed it — and it is where the NEW pill the reader may have
  // just clicked through from is sitting. The board shows through the dim behind it
  // either way.
  {
    id: 'sprints',
    since: TOUR_VERSION,
    navRoute: '/sprints',
    route: '/sprints',
    needsWorkspace: true,
    target: '[data-tour="nav-sprints"]',
    title: 'Sprints',
    body: 'Plan one from the board — anyone in the workspace can, not just an admin: pick its tickets, set a goal, watch the points come down. Dates are optional now; leave them blank and you get the next two weeks.',
    placement: 'right',
  },
  // Un-targeted on purpose: its subject is what happens when a sprint *ends*, which
  // is a behaviour rather than a control. There is nothing on screen to point at, and
  // pointing at the progress strip would attach the copy to the wrong thing.
  {
    id: 'sprint-rollover',
    since: TOUR_VERSION,
    needsWorkspace: true,
    title: 'Nothing is left behind',
    body: 'When a sprint ends the next one appears on its own and the unfinished tickets move across. Anything parked in Blocked counts as needing attention, so it shows on the strip.',
  },
  // No `route`: the sprints step already put the reader on `/sprints`, and
  // re-navigating would reset the page's scroll out from under the spotlight.
  {
    id: 'sprint-summary',
    since: TOUR_VERSION,
    needsWorkspace: true,
    target: '[data-tour="sprints-tab-summary"]',
    title: 'AI sprint recap',
    body: 'Summary writes the sprint up — themes, who carried what, what rolled over. A finished sprint recaps itself the first time you open the tab. It is a draft to read before you share it, not a record.',
    placement: 'bottom',
  },

  // The two things the ticket board gained. Drafts before bulk: one is about writing a
  // single ticket, the other about handling a pile of them.
  //
  // Drafts is un-targeted for a reason that is not laziness — the form it describes
  // exists only while the modal is open, and the tour cannot open a modal without
  // taking over the screen it also has to dim. So it routes to the board and reads as
  // a notice about the thing behind it.
  {
    id: 'ticket-drafts',
    since: TOUR_VERSION,
    route: '/tickets?view=board',
    needsWorkspace: true,
    title: 'Your half-written ticket is safe',
    body: 'Start a new ticket, close the modal, close the tab — the form comes back the way you left it, because the draft is kept on your account and not in this browser. Discard draft throws it away; creating the ticket clears it.',
  },
  // `?view=list` for the same reason the step above uses `?view=board`: it shows the
  // list without writing the view preference (see `viewParam` in `TicketPage`). The
  // board's own version of this control is per column, so the copy names it rather
  // than the tour visiting four columns to show the same button four times.
  // `navRoute` here even though Tickets is not a *new* row: the pill marks "something
  // in here is new", which is true of the page (drafts and bulk actions) and is what a
  // reader scanning the sidebar for what changed actually wants to know. Carried by
  // this step rather than the drafts one because a route can only be badged once.
  {
    id: 'tickets-bulk',
    since: TOUR_VERSION,
    navRoute: '/tickets',
    route: '/tickets?view=list',
    needsWorkspace: true,
    target: '[data-tour="tickets-select"]',
    title: 'Work a batch at once',
    body: 'Turn selection on and move or archive every ticket you tick in one go. Board columns have the same button, on the column.',
    placement: 'bottom',
  },

  // Intern-only. The logos landed in this release too (#316's two follow-ups), and
  // they are announced to the people who use the *picker*: 268 catalog entries stopped
  // rendering a neutral `</>` and now carry their real mark, which is the difference
  // between scanning a list and reading it. An admin or mentor meets the same marks on
  // an intern's profile without needing to be told they arrived.
  //
  // Pointed at the nav row rather than routed, because the news is not the page — it
  // is what the page looks like now, and a step that navigates there would spend a
  // load to say so.
  {
    id: 'skill-logos',
    since: TOUR_VERSION,
    roles: ['intern'],
    navRoute: '/my-technologies',
    target: '[data-tour="nav-my-technologies"]',
    title: 'Skills with their real logos',
    body: 'Position & Skills, and every picker in it, now shows the actual brand mark for most of the catalog — the AI half included — instead of a neutral code glyph.',
    placement: 'right',
  },

  // Mentor-only, and the one step in this script that is *not* from this release —
  // #307 gave mentors a real dashboard back in August and no tour has ever mentioned
  // it, because the release that followed it announced everything except that. The
  // one-release rule above is about not re-telling what was already told; a debt like
  // this is the opposite case, so it is paid here and then gone.
  //
  // It badges `/dashboard` all the same, even though the row is months old and the
  // page is not from this release. The pill does not claim "this shipped today", it
  // claims "there is something in here you have not been shown" — which for a mentor
  // and this page is exactly true, and is the whole reason the step exists.
  {
    id: 'mentor-dashboard',
    since: TOUR_VERSION,
    navRoute: '/dashboard',
    roles: ['mentor'],
    route: '/dashboard',
    needsWorkspace: true,
    target: '[data-tour="mentor-dashboard-interns"]',
    title: 'Your dashboard',
    body: 'No longer a bare ticket table: your interns and where each of them is, the tickets you are watching, the notes you have written, and your own quick actions.',
    placement: 'right',
  },

  // Last, and the only step that is not about the boards: it ends the tour standing in
  // front of a switch the reader can flip while they are looking at it, which is worth
  // more than any amount of copy describing a sidebar shape.
  //
  // Pointed at the Appearance card rather than at a section header in the sidebar
  // itself, even though the sidebar is the subject. The collapsible shape is opt-in and
  // `labelled` is still the default, so for most viewers there is no section header to
  // spotlight — only a 10.5px caption, and one with no `[data-tour]` on it. The card
  // that turns it on is on screen for everybody.
  //
  // Also the one step with no `needsWorkspace`: `/settings` sits outside
  // `WorkspaceGuard`, so this is the whole tour — rather than nothing at all — for an
  // intern between workspaces, a mentor without one, or an admin in Global admin mode.
  {
    id: 'nav-sections',
    since: TOUR_VERSION,
    route: '/settings',
    target: '[data-tour="settings-appearance"]',
    title: 'A sidebar that folds up',
    body: 'Nav groups can become sections that open one at a time, peek on hover, and collapse to a rail of marks — Azure’s sidebar, if that is how you like to work. Pick the shape here; the flat list stays the default.',
    placement: 'right',
  },
];

/**
 * Does this viewer have anything to be shown at all?
 *
 * The script is one release wide (see the note at the top of the array), so "nothing
 * new for you" is a state that can genuinely happen — every step in this one is
 * `needsWorkspace`, which is the empty script for an intern between workspaces, a
 * mentor without one, or an admin in Global admin mode. The button renders nothing in
 * that case rather than glowing for attention and then opening a tour with no steps
 * in it, which is the one way this feature can look broken rather than quiet.
 *
 * Same predicate the overlay filters with, so the two cannot disagree.
 */
export const useHasWhatsNewSteps = () => {
  const { user } = useAuth();
  const role = user?.role;
  const hasWorkspace = Boolean(user?.workspaceId);

  return useMemo(
    () => WHATS_NEW_STEPS.some((step) => stepAppliesTo(step, { role, hasWorkspace })),
    [role, hasWorkspace]
  );
};

/**
 * Stable identity for "nothing to badge", so a sidebar that has no NEW pills to paint
 * is not handed a fresh `Set` on every render.
 */
const NO_NEW_ROUTES = new Set();

/**
 * The nav routes to mark NEW — a `Set` for `AppSidebar` to test each row's `to`
 * against.
 *
 * Derived from the script above rather than listed separately, which is the point: a
 * release announces a nav row in exactly one place, and the pill beside that row and
 * the step that explains it cannot drift apart or be added without each other. A step
 * qualifies when it names a `navRoute`, its `since` is the *current* `TOUR_VERSION`,
 * and its `roles` (if any) include the viewer — the same role rule the overlay applies,
 * so nobody gets a pill on a row leading to a step they will not be shown.
 *
 * `since` rather than "whatever the newest steps are" is what keeps a bump from needing
 * a cleanup pass: last release's steps still carry last release's string, so they stop
 * badging on their own the moment `TOUR_VERSION` moves.
 *
 * Goes quiet the instant the tour is read (or the highlight switched off) — see
 * `useWhatsNewHighlight`.
 */
export const useNewFeatureRoutes = () => {
  const highlight = useWhatsNewHighlight();
  const { user } = useAuth();
  const role = user?.role;
  const hasWorkspace = Boolean(user?.workspaceId);

  return useMemo(() => {
    if (!highlight) return NO_NEW_ROUTES;

    const routes = WHATS_NEW_STEPS.filter(
      (step) =>
        step.navRoute && step.since === TOUR_VERSION && stepAppliesTo(step, { role, hasWorkspace })
    ).map((step) => step.navRoute);

    return routes.length ? new Set(routes) : NO_NEW_ROUTES;
  }, [highlight, role, hasWorkspace]);
};
