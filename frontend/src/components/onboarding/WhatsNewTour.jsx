import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMyAttendance } from '@/queries/attendance';
import { isExemptToday } from '@/helpers/attendance';
import { isIntern } from '@/helpers/roles';
import { resolveUserId } from '@/helpers/userIdentity';
import { THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';
import {
  TOUR_ENABLED,
  TOUR_REPLAY_EVENT,
  WHATS_NEW_STEPS,
  markWhatsNewSeen,
  useWhatsNewSeen,
} from './whatsNewSteps';
import { emitTourActive } from './tourPreview';

// Kept in step with the `w-[29rem]` on the card itself. This is only the
// first-frame guess — the real box is measured off `cardRef` — but a guess that
// disagrees with the rendered width makes the card jump on the frame it opens.
const CARD_WIDTH = 464;
const GAP = 14; // between the highlighted element and the card
const PAD = 8; // breathing room around the spotlight cut-out
const EDGE = 12; // minimum distance from the viewport edge

// How long a step waits for its target to appear before settling for a centred
// card. Longer than a dashboard round-trip so a cold open still lights every
// card up, short enough that a target which will never exist does not stall.
const TARGET_WAIT_MS = 4000;

// Deliberately heavy. With no panel behind the copy, the dim IS the background the
// text is read against, so it carries the contrast for the whole overlay.
const DIM = 'rgba(2, 6, 23, 0.82)';

/** A target counts as present only if it is actually laid out and visible. */
const visibleRect = (selector) => {
  const node = document.querySelector(selector);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return rect;
};

/** Whether a measured rect sits entirely within the viewport, with EDGE slack. */
const isFullyInViewport = (rect) =>
  rect.top >= EDGE &&
  rect.left >= EDGE &&
  rect.bottom <= window.innerHeight - EDGE &&
  rect.right <= window.innerWidth - EDGE;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const overlapArea = (a, b) => {
  const x = Math.max(0, Math.min(a.left + a.width, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.top + a.height, b.bottom) - Math.max(a.top, b.top));
  return x * y;
};

/**
 * Where to park the explanation card.
 *
 * The card must never sit on top of the thing it is describing — that was the
 * whole point of spotlighting it. So each of the four sides is tried, the ones
 * that fit fully on screen win, and among those the one that covers the least of
 * the highlighted area is chosen. A step targeting something large (the page
 * content area) has no side that "fits", so it falls back to the least-bad
 * option, which lands the card over the dimmed sidebar rather than over the
 * content being pointed at.
 */
const placeCard = (rect, card, preferred) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    return {
      left: Math.max(EDGE, vw / 2 - card.width / 2),
      top: Math.max(EDGE, vh / 2 - card.height / 2),
    };
  }

  const maxLeft = Math.max(EDGE, vw - card.width - EDGE);
  const maxTop = Math.max(EDGE, vh - card.height - EDGE);
  const midY = clamp(rect.top + rect.height / 2 - card.height / 2, EDGE, maxTop);
  const midX = clamp(rect.left + rect.width / 2 - card.width / 2, EDGE, maxLeft);

  const candidates = [
    {
      side: 'right',
      left: rect.right + GAP,
      top: midY,
      room: vw - rect.right - GAP - EDGE >= card.width,
    },
    {
      side: 'left',
      left: rect.left - GAP - card.width,
      top: midY,
      room: rect.left - GAP - EDGE >= card.width,
    },
    {
      side: 'bottom',
      left: midX,
      top: rect.bottom + GAP,
      room: vh - rect.bottom - GAP - EDGE >= card.height,
    },
    {
      side: 'top',
      left: midX,
      top: rect.top - GAP - card.height,
      room: rect.top - GAP - EDGE >= card.height,
    },
  ];

  const scored = candidates.map((candidate) => {
    const box = {
      left: clamp(candidate.left, EDGE, maxLeft),
      top: clamp(candidate.top, EDGE, maxTop),
      width: card.width,
      height: card.height,
    };
    return {
      ...candidate,
      box,
      overlap: overlapArea(box, rect),
      isPreferred: candidate.side === preferred,
    };
  });

  const fitting = scored.filter((c) => c.room && c.overlap === 0);

  // Nothing fits beside the target: it spans nearly the whole viewport, which is the
  // normal case for the ticket board and any full-width page region.
  //
  // This used to squeeze the card into whatever strip was left and floor the width
  // at 300px — "a sliver of a column is worse than a slight overhang", which
  // was true when the card was 340px wide with a 20px title. It is not true now. With
  // the board spotlit, the strip is the 258px sidebar, the floor forced the card to
  // 300px, and the 42px it gained put white-on-dim text on top of the brightly lit
  // board. Unreadable, and it clipped the headline mid-word.
  //
  // So: centre it at full width and tell the caller to put a scrim behind it. The
  // card lands on the target either way — the scrim is what makes that legible
  // instead of broken, and it is the only case that gets one.
  if (!fitting.length) {
    return {
      left: Math.max(EDGE, vw / 2 - card.width / 2),
      top: Math.max(EDGE, vh / 2 - card.height / 2),
      overlapping: true,
    };
  }

  fitting.sort((a, b) => {
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
    return 0;
  });

  const chosen = fitting[0];
  const { left, top } = chosen.box;

  // Without a panel behind it the text is light-on-dark, so it must not spill off the
  // dimmed area onto the brightly-lit spotlight — white on a light page is
  // unreadable. On a left/right placement, cap the width at the dim available on that
  // side. No floor here any more: this branch only runs when a side genuinely fits,
  // so the cap can never cut into the copy.
  let maxWidth;
  if (chosen.side === 'right') maxWidth = vw - rect.right - GAP - EDGE;
  else if (chosen.side === 'left') maxWidth = rect.left - GAP - EDGE;

  return { left, top, maxWidth };
};

/**
 * The "we moved things around" walkthrough from the shell redesign.
 *
 * Spotlights the controls that actually changed position by cutting a hole in a
 * dimmed overlay (a huge `box-shadow` spread on a transparent box — no SVG mask,
 * no extra dependency) and parking an explanatory card beside it.
 *
 * Deliberate choices:
 * - **Two ways in**: it opens itself once on the first load after a `TOUR_VERSION`
 *   bump, and the pulsing button in the sidebar footer reopens it any time. See
 *   `whatsNewSteps.js`.
 * - **No Skip control.** There used to be one, and it made the tour opt-out on step
 *   one — which for a release nobody has been told about is the same as not shipping
 *   the announcement. The walkthrough is short enough to finish (9–15 steps by role,
 *   fewer for a viewer a `needsWorkspace` or `needsAttendance` step does not apply
 *   to), the counter says how much is left, and Back covers moving too fast. Escape
 *   still ends it, deliberately unadvertised: it keeps this from being a trap for
 *   someone who cannot deal with it right now, without offering the bail-out as the
 *   obvious first move. Escaping counts as seen, exactly as Skip did, so nobody is
 *   interrupted twice.
 * - **No step is ever skipped for not having rendered yet.** The step count is
 *   exactly the number of entries in the script that apply to the viewer — so admin
 *   and intern legitimately see different totals, but neither ever loses a step they
 *   were entitled to. A target that has not rendered yet is waited for (see the
 *   measuring effect) and the card is centred meanwhile. An earlier version filtered
 *   the whole script by target presence in one frame at open time, which silently
 *   dropped every step whose card was still loading. The two `needs*` flags are not
 *   that filter returning: they drop a step whose subject the viewer cannot reach at
 *   all, decided from the account rather than from what the DOM happens to hold this
 *   frame. See the `steps` memo.
 * - **Nothing is highlighted until the element is measured**, the measurement
 *   re-runs on resize/scroll so a spotlight can never drift off its control, and a
 *   target below the fold is scrolled into view first rather than dimming the whole
 *   screen with nothing lit.
 * - **The active theme is left alone.** The overlay does not need one: the dim is a
 *   fixed dark wash in both themes and the copy is white-on-dim with a text shadow,
 *   so it reads the same either way. An earlier version forced light mode "so
 *   everyone sees the redesign in the same skin" and restored the choice on the way
 *   out — but `setTheme` persists, so any exit that did not run the restore (a
 *   reload, a closed tab) left the user's real preference overwritten. Not worth a
 *   preference for a one-time walkthrough.
 */
export function WhatsNewTour() {
  // `loading` (the /me fetch), not `isLoginPending` (the login mutation): the tour
  // must not measure anything until the shell has a user and has painted.
  const { user, loading } = useAuth();
  const seen = useWhatsNewSeen();
  const navigate = useNavigate();
  const location = useLocation();

  // Starts closed and is opened by one of two things: the sidebar's what's-new
  // button, or the first-login effect below. It is never open before there is a
  // user, so nothing measures against a half-built shell.
  const [dismissed, setDismissed] = useState(true);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardBox, setCardBox] = useState({ width: CARD_WIDTH, height: 250 });
  const cardRef = useRef(null);
  // One auto-open per mount. Without this, finishing the tour and then having
  // `seen` briefly disagree (or a refetch re-running the effect) would reopen it.
  const autoOpenedRef = useRef(false);
  // The last route this tour tried to send the reader to. Keyed by route rather
  // than by step so a guard that refuses the navigation is a single failed attempt
  // instead of a redirect loop — see the effect below.
  const attemptedRouteRef = useRef(null);

  const role = user?.role;
  // Whether this viewer can be routed behind `WorkspaceGuard` at all — see the
  // `needsWorkspace` steps in the filter below.
  const hasWorkspace = Boolean(user?.workspaceId);

  // `placedAt` is the one thing a step needs that `/me` does not carry — it lives on
  // the intern profile, so it has to be asked for. Fetched only for an intern, and
  // only once the tour is actually open, so the shell does not pay a request per load
  // for a banner shown once a release. The page this step routes to uses the same
  // query key, so an intern who has been there already pays nothing.
  const { data: attendance } = useMyAttendance({
    enabled: isIntern(role) && !dismissed,
  });
  const onProject = isExemptToday(attendance?.placedAt ?? null);
  // The seen-state is keyed per account, so marking it needs to know whose it is.
  const userId = resolveUserId(user);

  /**
   * The steps this viewer gets — filtered by role, and by whether a step's route is
   * reachable for them at all.
   *
   * Every role gets every step that applies to them, every time the version is
   * bumped. An earlier version of this filtered out steps from previous releases
   * for returning users — that was wrong: a release is announced as one story, and
   * dropping the shell steps left interns walked through new cards inside a shell
   * nobody had walked them through. If a tour ever gets long enough to need
   * trimming, cut steps from the script rather than hiding them per-viewer.
   *
   * **This list is also the step count, and it is never narrowed at runtime.** An
   * earlier version additionally filtered by whether each step's `[data-tour]`
   * target was in the DOM, resolved once in a single `requestAnimationFrame`. Every
   * dashboard card target lives inside a `isPending ? <Skeleton/> : <Card/>`
   * branch, so on a cold load those targets did not exist yet and the steps
   * announcing them were dropped permanently — an admin saw 8 of 12, an intern 7 of
   * 12, silently, with the counter reporting the reduced total so nothing looked
   * wrong. A step the role is entitled to is now always shown; a target that has
   * not arrived yet is waited for per-step in the measuring effect below, and until
   * it does the card is simply centred.
   *
   * `needsWorkspace` is the one exception, and it exists because of the navigation
   * effect rather than the copy. A step routing behind `WorkspaceGuard` bounces a
   * viewer with no `workspaceId` to `/create-workspace`, which `SidebarLayout` does
   * not serve — so this overlay unmounts mid-walkthrough, `finish` never runs, and
   * the next load auto-opens the same tour into the same bounce. Keeping the step
   * would make the announcement unfinishable for that viewer; dropping it costs them
   * a step about a board they cannot open. Not a role check: interns between
   * workspaces, mentors without one and admins in Global admin mode are all here.
   *
   * `needsAttendance` is the same kind of exception for the same kind of reason. An
   * intern already on a project owes no attendance, so `MyAttendancePage` withdraws
   * the request panel the step points at — and the copy ("ask for remote days here")
   * is false for them twice over: there is no panel, and there is nothing to request.
   * A second anchor would only spotlight the notice that says the opposite.
   */
  const steps = useMemo(
    () =>
      WHATS_NEW_STEPS.filter((step) => {
        if (step.roles && !step.roles.includes(role)) return false;
        if (step.needsWorkspace && !hasWorkspace) return false;
        if (step.needsAttendance && onProject) return false;
        return true;
      }),
    [role, hasWorkspace, onProject]
  );

  const finish = useCallback(() => {
    markWhatsNewSeen(userId);
    setDismissed(true);
  }, [userId]);

  // The step list can shrink under an open tour: the attendance query lands and a
  // `needsAttendance` step drops, or the viewer's role or workspace changes. If that
  // leaves `index` past the end, `step` is undefined and the render below bails to
  // `null` — a tour that is on screen, unreadable and never marked seen, so the next
  // load auto-opens it into the same dead end. Count it finished instead: everything
  // still on the list has already been read.
  useEffect(() => {
    if (!dismissed && steps.length && index >= steps.length) finish();
  }, [dismissed, index, steps.length, finish]);

  // First login on a new design: show the tour unprompted, once. Gated on the
  // *versioned* seen-state, so bumping TOUR_VERSION re-announces to everyone
  // exactly once and a returning viewer is never re-interrupted.
  //
  // Opening while dashboard data is still in flight is safe now: no step is
  // dropped for a missing target, so the only effect of an early open is that the
  // first card or two are centred until their element lands.
  // `TOUR_ENABLED` is off for now so the overlay cannot block the automation suite —
  // see the flag's note in `whatsNewSteps.js`. With no auto-open and no replay, the
  // tour stays `dismissed`, `step` is null, and this component renders nothing.
  useEffect(() => {
    if (!TOUR_ENABLED) return;
    if (autoOpenedRef.current || seen || !user || loading || steps.length === 0) return;
    autoOpenedRef.current = true;
    setIndex(0);
    setDismissed(false);
  }, [seen, user, loading, steps.length]);

  const tourActive = !dismissed && steps.length > 0;

  // Broadcast so the intern dashboard can fill genuinely empty cards with example
  // data for the duration — the tour explains cards by pointing at them, and
  // pointing at "No recommendation yet" while describing a placement timeline
  // teaches nobody anything. See `tourPreview.js` for the rules that keeps safe.
  useEffect(() => {
    emitTourActive(tourActive);
    return () => emitTourActive(false);
  }, [tourActive]);

  // Opened on demand — the sidebar's what's-new button fires this.
  useEffect(() => {
    if (!TOUR_ENABLED) return undefined;
    const onReplay = () => {
      setIndex(0);
      attemptedRouteRef.current = null;
      setDismissed(false);
    };
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, []);

  const step = !dismissed && steps.length > 0 ? steps[index] : null;
  const isLast = index === steps.length - 1;

  const go = useCallback(
    (direction) => {
      const next = index + direction;
      if (next < 0) return;
      if (next >= steps.length) {
        finish();
        return;
      }
      setIndex(next);
    },
    [finish, index, steps.length]
  );

  /**
   * Steps that are about a whole page open it, rather than describing it from
   * wherever the reader happens to be standing.
   *
   * A step whose subject is a page — Settings, the ticket list, the attendance page
   * — reads as an instruction to go and look later, which nobody does. Navigating
   * puts the thing itself under the dim while the card describes it. Every route
   * used this way has to live inside `SidebarLayout`, which is what mounts this
   * overlay: a route on any other layout would unmount the tour mid-walkthrough.
   *
   * Guarded on the *route* and not the step id, so a route a guard refuses (an
   * intern with no workspace bounced off `/tickets`) is one failed attempt rather
   * than a navigate/bounce loop. Cleared once we arrive — compared against the
   * pathname *and* the query, because a `route` may carry one (`?view=board`) and a
   * pathname-only match would never clear it — so stepping back and forward through
   * the same step navigates again.
   *
   * The reader is deliberately left wherever the last step took them. They were
   * just told the page exists; dropping them back on the dashboard would undo that.
   */
  useEffect(() => {
    const route = step?.route;
    if (!route || `${location.pathname}${location.search}` === route) {
      attemptedRouteRef.current = null;
      return;
    }
    if (attemptedRouteRef.current === route) return;
    attemptedRouteRef.current = route;
    navigate(route);
  }, [step, location.pathname, location.search, navigate]);

  // Keep the spotlight glued to its element.
  //
  // Two things beyond a plain measure, both because a step is never skipped for a
  // missing target:
  //
  // 1. WAIT. Every dashboard card's `[data-tour]` anchor lives inside a
  //    `isPending ? <Skeleton/> : <Card/>` branch, so reaching its step before that
  //    query resolves finds nothing. Measuring once would leave the card centred
  //    for the rest of the step; instead poll until the element appears, up to
  //    TARGET_WAIT_MS — comfortably longer than a dashboard fetch, short enough
  //    that a genuinely absent target (a control this role does not have) settles
  //    quickly as a centred notice rather than hanging the step.
  // 2. SCROLL. The spotlight is positioned in viewport coordinates, so a target
  //    below the fold used to dim the whole screen with nothing lit. Bring it into
  //    view first, then measure on the next frame once the scroll has applied.
  useLayoutEffect(() => {
    if (!step) return undefined;
    if (!step.target) {
      setRect(null);
      return undefined;
    }

    let cancelled = false;
    let frame = 0;
    const deadline = performance.now() + TARGET_WAIT_MS;

    const settle = () => {
      if (cancelled) return;

      const found = visibleRect(step.target);
      if (found) {
        const node = document.querySelector(step.target);
        if (node && !isFullyInViewport(found)) {
          node.scrollIntoView({ block: 'center', inline: 'nearest' });
          frame = requestAnimationFrame(() => {
            if (!cancelled) setRect(visibleRect(step.target));
          });
          return;
        }
        setRect(found);
        return;
      }

      // Not there yet — render centred meanwhile, and keep looking.
      setRect(null);
      if (performance.now() < deadline) frame = requestAnimationFrame(settle);
    };

    settle();

    const measure = () => setRect(visibleRect(step.target));
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    setCardBox({ width, height });
  }, [step, rect]);

  useEffect(() => {
    if (!step) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish();
      else if (event.key === 'ArrowRight' || event.key === 'Enter') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finish, go, step]);

  if (!step) return null;

  const { overlapping, ...cardPosition } = placeCard(rect, cardBox, step.placement);
  const position = index + 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      {/* The dim. When a target is measured, the cut-out is this element's box and
          the dimming is its outward shadow, which leaves the real control visible
          and — because the overlay itself is click-through-blocked — unclickable
          until the tour ends. */}
      {rect ? (
        <div
          className="pointer-events-auto absolute rounded-[var(--r-card)] ring-2 ring-primary/70 transition-all duration-200 motion-reduce:transition-none"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: `0 0 0 9999px ${DIM}`,
          }}
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: DIM }} />
      )}

      {/* No panel — the copy sits directly on the dim. It is therefore always
          light-on-dark regardless of the active theme (the overlay is dark in both),
          and every text layer carries a shadow so it stays legible over whatever
          happens to be underneath it. */}
      <div
        ref={cardRef}
        // `font-sans` is the Task Manager font, stated rather than inherited: this
        // card is portaled to `document.body`, outside the React tree every other
        // surface takes its typography from, so a wrapper with a font of its own
        // would silently change what the tour reads in.
        //
        // It is deliberately NOT Poppins, despite the "Poppins throughout" comment
        // on the type tokens in `index.css`. That comment is wrong about this app:
        // Poppins is declared only under `[data-surface="symphony"]`, the Leadership
        // surface, and Task Manager renders on Tailwind's preflight `html` stack —
        // which is what `font-sans` resolves to. The tour only ever mounts inside
        // `SidebarLayout`, never on the Symphony surface, so matching Task Manager
        // is matching everything it will ever cover. Putting Poppins here would make
        // the overlay the one thing on screen in a different typeface.
        //
        // Sized well above the app's body copy on purpose. This is a full-screen
        // interruption read once, at a glance, from whatever distance the person
        // happens to be sitting at — and it is white-on-dim with a shadow, which
        // costs contrast that extra weight and size buy back.
        className={cn(
          'absolute w-[29rem] font-sans',
          // Only when the card had to land on its own spotlight — see `placeCard`.
          // Everywhere else the dim is the background the copy is read against, and a
          // panel would be a second frame around text that does not need one.
          overlapping && 'rounded-[var(--r-card)] bg-slate-950/85 p-5 ring-1 ring-white/10',
          '[text-shadow:0_1px_14px_rgba(2,6,23,0.95)]'
        )}
        style={{ ...cardPosition, maxWidth: cardPosition.maxWidth ?? 'calc(100vw - 2rem)' }}
      >
        <div className="flex items-center gap-2 text-white/70">
          <Sparkles className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.16em]">
            What&apos;s new
          </span>
          <span className="text-[13px] font-medium tabular-nums text-white/50">
            {position} / {steps.length}
          </span>
        </div>

        {/* Upper-cased in CSS rather than in the strings: the script stays readable
            and a screen reader still gets sentence case, which it reads as words
            instead of spelling out. Caps need the letter-spacing opened up — the
            negative tracking that suits a mixed-case headline closes caps into a
            block. */}
        <h2
          id="whats-new-title"
          className="mt-3 text-[40px] font-extrabold uppercase leading-[1.05] tracking-[0.01em] text-white"
        >
          {step.title}
        </h2>
        <p className="mt-3 text-[15.5px] leading-[1.55] text-white/75">{step.body}</p>

        {/* Shown, not listed. "Eleven accent palettes" is a claim; the eleven gradients
            are the thing itself, and they come straight from `THEMES`, so a palette
            added or retuned there is reflected here with no edit. `aria-hidden`
            because the copy above already says what they are — to a screen reader
            these are eleven unlabelled decorations. */}
        {step.swatches && (
          <div className="mt-3.5 flex flex-wrap gap-1.5" aria-hidden="true">
            {THEMES.map((theme) => (
              <span
                key={theme.id}
                title={theme.label}
                className="h-7 w-7 rounded-[var(--r-control)] ring-1 ring-inset ring-white/25"
                style={{ background: theme.preview.gradient }}
              />
            ))}
          </div>
        )}

        {/* Said on the way out so nobody has to hunt for the way back in, so that
            closing this does not feel like a one-shot you might regret, and so the
            glow is understood as a standing signal rather than a one-off — people
            who know what it means are the ones who will click it next time. */}
        {isLast && (
          <p className="mt-3.5 text-[13px] leading-5 text-white/65">
            This is how we will show you what&apos;s new from now on. The{' '}
            <span className="font-medium text-white/90">Notice some changes?</span> button just
            above your name, at the bottom of the sidebar, reopens this any time — and whenever we
            ship something new it will start glowing again to let you know there is something to
            read.
          </p>
        )}

        <div className="mt-4 flex items-center gap-2 [text-shadow:none]">
          <button
            type="button"
            onClick={() => go(1)}
            data-test="whats-new-next"
            className="inline-flex items-center gap-1.5 rounded-[var(--r-card)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {isLast ? 'Got it' : 'Next'}
            {!isLast && <ArrowRight className="h-4 w-4" />}
          </button>

          {position > 1 && (
            <button
              type="button"
              onClick={() => go(-1)}
              data-test="whats-new-back"
              className="inline-flex items-center gap-1.5 rounded-[var(--r-card)] px-3 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
