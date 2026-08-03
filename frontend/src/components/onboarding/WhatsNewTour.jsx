import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import {
  TOUR_REPLAY_EVENT,
  TOUR_STORAGE_KEY,
  TOUR_VERSION,
  WHATS_NEW_STEPS,
} from './whatsNewSteps';

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

const readSeenVersion = () => {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY);
  } catch {
    // Private mode / storage disabled: treat as "already seen" rather than
    // showing the tour on every single page load.
    return TOUR_VERSION;
  }
};

const writeSeenVersion = () => {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, TOUR_VERSION);
  } catch {
    /* nothing we can do, and not worth surfacing to the user */
  }
};

/**
 * One-time "we moved things around" walkthrough, shown after the shell redesign.
 *
 * Spotlights the controls that actually changed position by cutting a hole in a
 * dimmed overlay (a huge `box-shadow` spread on a transparent box — no SVG mask,
 * no extra dependency) and parking an explanatory card beside it.
 *
 * Deliberate choices:
 * - **Steps with a missing target are skipped**, so the same script serves every
 *   role and every breakpoint. The collapse button is `md:`-only, so on a phone
 *   that step simply does not appear.
 * - **Nothing is highlighted until the element is measured**, and the measurement
 *   re-runs on resize/scroll, so a spotlight can never drift off its control.
 * - **Seen-state is versioned** rather than boolean, so the next redesign only has
 *   to bump `TOUR_VERSION`.
 */
export function WhatsNewTour() {
  // `loading` (the /me fetch), not `isLoginPending` (the login mutation): the tour
  // must not measure anything until the shell has a user and has painted.
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(() => readSeenVersion() === TOUR_VERSION);
  const [visibleSteps, setVisibleSteps] = useState([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardBox, setCardBox] = useState({ width: CARD_WIDTH, height: 180 });
  const cardRef = useRef(null);

  // The tour is shown in light theme so everyone sees the redesign in the same
  // skin the screenshots and the handover notes use. The previous choice is stashed
  // in a ref (not state — restoring must not depend on a re-render) and put back on
  // the way out, so this borrows the theme rather than overwriting a preference.
  const { theme, setTheme } = useTheme();
  const themeBeforeTour = useRef(null);

  const role = user?.role;

  // Role filtering happens here; target-presence filtering has to wait until the
  // shell has painted, so it is resolved per-step during navigation below.
  const steps = useMemo(
    () => WHATS_NEW_STEPS.filter((step) => !step.roles || step.roles.includes(role)),
    [role]
  );

  const finish = useCallback(() => {
    writeSeenVersion();
    setDismissed(true);
    setVisibleSteps([]);

    if (themeBeforeTour.current) {
      setTheme(themeBeforeTour.current);
      themeBeforeTour.current = null;
    }
  }, [setTheme]);

  // Resolve which steps are actually showable ONCE, when the tour opens, and drive
  // everything from that list. Filtering per-navigation instead would make the
  // "3 / 6" counter count steps that get skipped and mislabel the final button.
  // Measured in a rAF so the shell has painted and the targets have real boxes.
  useEffect(() => {
    if (dismissed || !user || loading || steps.length === 0) return undefined;

    const frame = requestAnimationFrame(() => {
      const usable = steps.filter((step) => !step.target || visibleRect(step.target));
      if (usable.length === 0) {
        finish();
        return;
      }
      setVisibleSteps(usable);
      setIndex(0);
    });

    return () => cancelAnimationFrame(frame);
  }, [dismissed, user, loading, steps, finish]);

  // Force light for the duration, in its own effect keyed only on "is the tour up".
  // Deliberately NOT folded into the effect above: that one would then depend on
  // `theme`, which it changes, so it would re-run and reset the tour to step 1.
  // The live theme is read through a ref for the same reason.
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const tourActive = !dismissed && visibleSteps.length > 0;
  useEffect(() => {
    if (!tourActive || themeBeforeTour.current) return;
    themeBeforeTour.current = themeRef.current || 'system';
    setTheme('light');
  }, [tourActive, setTheme]);

  // Replay on demand — the user menu item and the hold-H shortcut both fire this.
  useEffect(() => {
    const onReplay = () => {
      setIndex(0);
      setDismissed(false);
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

        {/* Told on the way out, where it is actually useful: the replay shortcut is
            hidden by design, so it has to be said out loud at least once. */}
        {isLast && (
          <p className="mt-3 text-[11px] leading-4 text-white/60">
            Want to see this again? Hold{' '}
            <kbd className="rounded border border-white/25 px-1 font-semibold text-white/90">H</kbd>{' '}
            and click the Task&nbsp;Manager logo at the top of the sidebar — or pick{' '}
            <span className="font-medium text-white/90">What&apos;s new</span> from your profile
            menu.
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
