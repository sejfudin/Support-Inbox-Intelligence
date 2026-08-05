import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { TOUR_REPLAY_EVENT, WHATS_NEW_STEPS, markWhatsNewSeen } from './whatsNewSteps';
import { emitTourActive } from './tourPreview';

const CARD_WIDTH = 340;
const GAP = 14; // between the highlighted element and the card
const PAD = 8; // breathing room around the spotlight cut-out
const EDGE = 12; // minimum distance from the viewport edge
const MIN_TEXT_WIDTH = 240; // never squeeze the copy below this

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
 * - **Opened on request only.** It never launches itself on login; the pulsing
 *   button in the dashboard header is the way in. See `whatsNewSteps.js`.
 * - **Steps with a missing target are skipped**, so the same script serves every
 *   role and every breakpoint. The collapse button is `md:`-only, so on a phone
 *   that step simply does not appear.
 * - **Nothing is highlighted until the element is measured**, and the measurement
 *   re-runs on resize/scroll, so a spotlight can never drift off its control.
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
  // Starts closed, always — the tour is opened by the header button and nothing
  // else. Seen-state lives in localStorage and is read by the *button* (to decide
  // whether to pulse), not here; this component only ever writes it, on the way
  // out, so re-opening an already-seen tour works without any extra state.
  const [dismissed, setDismissed] = useState(true);
  const [visibleSteps, setVisibleSteps] = useState([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardBox, setCardBox] = useState({ width: CARD_WIDTH, height: 180 });
  const cardRef = useRef(null);

  const role = user?.role;

  // Bumped by every replay. See the resolution effect below for why it exists.
  const [runId, setRunId] = useState(0);

  // Role filtering happens here; target-presence filtering has to wait until the
  // shell has painted, so it is resolved per-step during navigation below.
  //
  // Every role gets every step that applies to them, every time the version is
  // bumped. An earlier version of this filtered out steps from previous releases
  // for returning users — that was wrong: a release is announced as one story, and
  // dropping the shell steps left interns walked through new cards inside a shell
  // nobody had walked them through. If a tour ever gets long enough to need
  // trimming, cut steps from the script rather than hiding them per-viewer.
  const steps = useMemo(
    () => WHATS_NEW_STEPS.filter((step) => !step.roles || step.roles.includes(role)),
    [role]
  );

  const finish = useCallback(() => {
    markWhatsNewSeen();
    setDismissed(true);
    setVisibleSteps([]);
  }, []);

  // Resolve which steps are actually showable ONCE, when the tour opens, and drive
  // everything from that list. Filtering per-navigation instead would make the
  // "3 / 6" counter count steps that get skipped and mislabel the final button.
  // Measured in a rAF so the shell has painted and the targets have real boxes.
  useEffect(() => {
    if (dismissed || !user || loading || steps.length === 0) return undefined;

    const frame = requestAnimationFrame(() => {
      const usable = steps.filter((step) => !step.target || visibleRect(step.target));
      if (usable.length === 0) {
        // Every open is now an explicit click, so silently closing again would
        // read as a dead button. Fall back to the step that never has a target —
        // the intro always qualifies.
        setVisibleSteps(steps.slice(0, 1));
        setIndex(0);
        return;
      }
      setVisibleSteps(usable);
      setIndex(0);
    });

    return () => cancelAnimationFrame(frame);
    // `runId` is what makes replay reliable: it changes on every open, so this
    // re-resolves even when nothing else did. Without it the effect depended on
    // `dismissed` flipping *and* on `steps` keeping its identity — and re-opening
    // an already-dismissed-but-mounted tour could resolve to nothing at all.
  }, [dismissed, user, loading, steps, runId]);

  const tourActive = !dismissed && visibleSteps.length > 0;

  // Broadcast so the intern dashboard can fill genuinely empty cards with example
  // data for the duration — the tour explains cards by pointing at them, and
  // pointing at "No recommendation yet" while describing a placement timeline
  // teaches nobody anything. See `tourPreview.js` for the rules that keeps safe.
  useEffect(() => {
    emitTourActive(tourActive);
    return () => emitTourActive(false);
  }, [tourActive]);

  // Opened on demand — the dashboard's what's-new button fires this.
  useEffect(() => {
    const onReplay = () => {
      setIndex(0);
      setDismissed(false);
      setRunId((n) => n + 1);
    };
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, []);

  const step = !dismissed && visibleSteps.length > 0 ? visibleSteps[index] : null;
  const isLast = index === visibleSteps.length - 1;

  const go = useCallback(
    (direction) => {
      const next = index + direction;
      if (next < 0) return;
      if (next >= visibleSteps.length) {
        finish();
        return;
      }
      setIndex(next);
    },
    [finish, index, visibleSteps.length]
  );

  // Keep the spotlight glued to its element.
  useLayoutEffect(() => {
    if (!step) return undefined;
    if (!step.target) {
      setRect(null);
      return undefined;
    }

    const measure = () => setRect(visibleRect(step.target));
    measure();

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
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
            {position} / {visibleSteps.length}
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
            <span className="font-medium text-white/90">Notice some changes?</span> button on your
            dashboard reopens this any time — and whenever we ship something new, it will start
            glowing again to let you know there is something to read.
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
