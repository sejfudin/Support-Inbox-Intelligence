import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  TOUR_REPLAY_EVENT,
  WHATS_NEW_STEPS,
  markWhatsNewSeen,
  useWhatsNewSeen,
} from './whatsNewSteps';
import { emitTourActive } from './tourPreview';

const CARD_WIDTH = 340;
const GAP = 14; // between the highlighted element and the card
const PAD = 8; // breathing room around the spotlight cut-out
const EDGE = 12; // minimum distance from the viewport edge
const MIN_TEXT_WIDTH = 240; // never squeeze the copy below this

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
  const pool = fitting.length ? fitting : scored;

  pool.sort((a, b) => {
    if (a.overlap !== b.overlap) return a.overlap - b.overlap;
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
    return 0;
  });

  const chosen = pool[0];
  const { left, top } = chosen.box;

  // Without a panel behind it the text is light-on-dark, so it must not spill off
  // the dimmed area onto the brightly-lit spotlight — white on a light page is
  // unreadable. On a left/right placement, cap the width at the dim available on
  // that side. Floored, because a sliver of a column is worse than a slight
  // overhang; in practice the sidebar gutter is wide enough.
  let maxWidth;
  if (chosen.side === 'right') maxWidth = Math.max(MIN_TEXT_WIDTH, vw - rect.right - GAP - EDGE);
  else if (chosen.side === 'left') maxWidth = Math.max(MIN_TEXT_WIDTH, rect.left - GAP - EDGE);

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
 * - **No step is ever skipped.** The step count is exactly the number of entries in
 *   the script that apply to the viewer's role — so admin and intern legitimately
 *   see different totals, but neither ever loses a step they were entitled to. A
 *   target that has not rendered yet is waited for (see the measuring effect) and
 *   the card is centred meanwhile. An earlier version filtered the whole script by
 *   target presence in one frame at open time, which silently dropped every step
 *   whose card was still loading.
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

  // Starts closed and is opened by one of two things: the sidebar's what's-new
  // button, or the first-login effect below. It is never open before there is a
  // user, so nothing measures against a half-built shell.
  const [dismissed, setDismissed] = useState(true);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardBox, setCardBox] = useState({ width: CARD_WIDTH, height: 180 });
  const cardRef = useRef(null);
  // One auto-open per mount. Without this, finishing the tour and then having
  // `seen` briefly disagree (or a refetch re-running the effect) would reopen it.
  const autoOpenedRef = useRef(false);

  const role = user?.role;

  /**
   * The steps this viewer gets — filtered by role and by nothing else.
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
   */
  const steps = useMemo(
    () => WHATS_NEW_STEPS.filter((step) => !step.roles || step.roles.includes(role)),
    [role]
  );

  const finish = useCallback(() => {
    markWhatsNewSeen();
    setDismissed(true);
  }, []);

  // First login on a new design: show the tour unprompted, once. Gated on the
  // *versioned* seen-state, so bumping TOUR_VERSION re-announces to everyone
  // exactly once and a returning viewer is never re-interrupted.
  //
  // Opening while dashboard data is still in flight is safe now: no step is
  // dropped for a missing target, so the only effect of an early open is that the
  // first card or two are centred until their element lands.
  useEffect(() => {
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
    const onReplay = () => {
      setIndex(0);
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

  const cardStyle = placeCard(rect, cardBox, step.placement);
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
          className="pointer-events-auto absolute rounded-xl ring-2 ring-primary/70 transition-all duration-200 motion-reduce:transition-none"
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
        className="absolute w-[23rem] [text-shadow:0_1px_14px_rgba(2,6,23,0.95)]"
        style={{ ...cardStyle, maxWidth: cardStyle.maxWidth ?? 'calc(100vw - 2rem)' }}
      >
        <div className="flex items-center gap-2 text-white/70">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            What&apos;s new
          </span>
          <span className="text-[11px] font-medium tabular-nums text-white/50">
            {position} / {steps.length}
          </span>
        </div>

        <h2 id="whats-new-title" className="mt-2 text-xl font-semibold leading-7 text-white">
          {step.title}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-white/75">{step.body}</p>

        {/* Said on the way out so nobody has to hunt for the way back in, so that
            closing this does not feel like a one-shot you might regret, and so the
            glow is understood as a standing signal rather than a one-off — people
            who know what it means are the ones who will click it next time. */}
        {isLast && (
          <p className="mt-3 text-[11px] leading-4 text-white/60">
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {isLast ? 'Got it' : 'Next'}
            {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
          </button>

          {position > 1 && (
            <button
              type="button"
              onClick={() => go(-1)}
              data-test="whats-new-back"
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}

          <button
            type="button"
            onClick={finish}
            data-test="whats-new-skip"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
          >
            <X className="h-3.5 w-3.5" />
            Skip
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
