import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useThemeConfig } from '@/context/ThemeConfigContext';
import { DEFAULT_COLOR_THEME } from '@/lib/themes';
import { TASK_MANAGER_PETAL_SRCS } from '@/lib/brandAssets';

/**
 * The brand loader: the mark unfurling one petal at a time, a line of text, and — for the
 * two variants that cover something — a veil over whatever is behind it.
 *
 * Use it for a wait whose result has no shape to imitate: app boot, a whole page whose
 * layout is decided by the data, a lazily-loaded chunk, a modal body that fetches before it
 * can draw anything. Where the shape IS known — a table, a card grid, a list of rows — use a
 * skeleton from `components/Skeletons/` instead, because a skeleton that is the wrong shape
 * is a second layout the page jumps out of. And leave button spinners alone: those say "your
 * click is working", which is a different sentence from "the page is arriving".
 *
 * The animation itself lives in `index.css` (`.logo-loader`) so the four petals can carry the
 * stagger and the per-palette masking in CSS. This file only composes it.
 */

// 32px sits in a panel body, 64px in a modal, 132px is the splash size the handoff demos.
// Three, matching the rest of the library's size vocabulary rather than adding a fourth scale.
const SIZES = {
  sm: 32,
  md: 64,
  lg: 132,
};

// The handoff's label, at every size: 13px, medium, uppercase, tracked 0.08em, muted. It was
// tempting to set the two smaller sizes in sentence case so a 32px loader in a card wouldn't
// read as a heading — but the loader is a brand moment and it should be the same object
// wherever it appears, so the only thing that changes with size is the type scale.
const LABEL = {
  sm: 'text-[11px] font-medium uppercase tracking-[0.08em]',
  md: 'text-[12px] font-medium uppercase tracking-[0.08em]',
  lg: 'text-[13px] font-medium uppercase tracking-[0.08em]',
};

const GAP = {
  sm: 'gap-2.5',
  md: 'gap-4',
  lg: 'gap-6',
};

// An inline loader stands in for content, so it has to occupy space like content. Without this it
// collapsed to its own height inside a card that had no padding of its own, and the mark spilled
// out over the card's top edge with the label stranded below it — which is exactly what an empty
// `app-card` wrapper did on the intern attendance tab.
const MIN_HEIGHT = {
  sm: 'min-h-[104px]',
  md: 'min-h-[160px]',
  lg: 'min-h-[240px]',
};

/**
 * The animation on its own, without text or a backdrop — for the rare spot that has its own
 * copy already and only wants the mark. Most callers want `Loader`.
 */
export function LoaderMark({ size = 'md', speed, className }) {
  const { colorTheme, ready } = useThemeConfig();
  // Before the stored preference has resolved, draw the house palette rather than flashing
  // whatever the last theme was — same guard TaskManagerBrand uses.
  const activeTheme = ready ? colorTheme : DEFAULT_COLOR_THEME;

  return (
    <span
      className={cn('logo-loader block shrink-0', className)}
      style={{
        '--loader-size': `${SIZES[size] ?? SIZES.md}px`,
        ...(speed ? { '--loader-speed': speed } : null),
      }}
      // Scoped to this element, not the document, exactly as TaskManagerBrand scopes it: the
      // CSS rule that flattens the petals to `--primary` keys off this attribute.
      data-theme-brand={activeTheme}
      data-test="loader-mark"
      aria-hidden
    >
      {TASK_MANAGER_PETAL_SRCS.map((src) => (
        <span key={src} style={{ '--petal': `url(${src})` }} />
      ))}
    </span>
  );
}

// The global hold: every loader stays up for at least this long once it has appeared.
//
// A floor, not a duration — the loader comes down when the data is in, and this only stops it
// flashing. 1.5s is the settled value after three wrong ones: 400ms was too short to read as
// anything (the mark barely began to unfurl), 2200ms — a full turn of the animation — made every
// screen feel like it was waiting on something when it wasn't, and 1s cut the sweep just short of
// where it reads as deliberate.
//
// One constant, applied at every surface through `useLoaderHold`, so the app has a single loading
// rhythm instead of each screen inventing its own.
export const MIN_VISIBLE_MS = 1500;

/**
 * Keeps a loader on screen for at least `minVisibleMs` once it has appeared.
 *
 * This cannot live inside `Loader`: the parent decides whether the loader is mounted at all, so
 * a component cannot hold itself past the moment its `isPending` goes false. Hence a hook that
 * returns a flag which is a strict superset of the query's own — true for as long as the query
 * is pending, then for whatever is left of the minimum. Because it never goes false while the
 * data is still missing, it is safe to use it for the early return that guards the render:
 *
 *   const showLoader = useLoaderHold(isPending);
 *   if (showLoader) return <Loader label="…" />;
 *
 * A cached response that resolves instantly still shows the loader for one full turn of the
 * animation — see `MIN_VISIBLE_MS` for why that is a floor and not a duration.
 *
 * Two things end the hold early, and both exist because a floor that ignores them is a toll
 * rather than a rhythm:
 *
 * `release` — pass the query's `isError`. A failed query has nothing arriving, so there is
 * nothing to hold the mark for, and every screen that renders its error banner independently of
 * its loading branch would otherwise show the two stacked on each other for a second and a half.
 *
 * The floor is also a *first-arrival* effect, not a per-fetch one. Paging a table, stepping a
 * month or retyping a filter re-enters `isPending` on a screen that has already introduced
 * itself; charging it another 1.5s each time is what the floor was meant to avoid the feeling
 * of. So once a hold has run its course the flag simply follows the query for the rest of the
 * mount, and navigating to the screen afresh arms it again.
 */
export function useLoaderHold(active, { minVisibleMs = MIN_VISIBLE_MS, release = false } = {}) {
  const [holding, setHolding] = useState(active);
  const startedAt = useRef(null);
  const hasHeld = useRef(false);

  useEffect(() => {
    if (release) {
      startedAt.current = null;
      setHolding(false);
      return undefined;
    }

    if (active) {
      if (startedAt.current === null) startedAt.current = Date.now();
      setHolding(true);
      return undefined;
    }

    if (startedAt.current === null) {
      setHolding(false);
      return undefined;
    }

    const settle = () => {
      startedAt.current = null;
      hasHeld.current = true;
      setHolding(false);
    };

    const remaining = hasHeld.current ? 0 : minVisibleMs - (Date.now() - startedAt.current);
    if (remaining <= 0) {
      settle();
      return undefined;
    }

    const timer = setTimeout(settle, remaining);
    return () => clearTimeout(timer);
  }, [active, minVisibleMs, release]);

  return holding;
}

export function Loader({
  size = 'md',
  variant = 'inline',
  label = 'Loading…',
  speed,
  className,
  style,
  ...props
}) {
  const covering = variant === 'panel' || variant === 'screen' || variant === 'overlay';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 text-center',
        GAP[size] ?? GAP.md,
        // The covering variants take their height from what they cover, so the floor only applies
        // to the inline one, which has nothing else to give it any.
        variant === 'inline' && (MIN_HEIGHT[size] ?? MIN_HEIGHT.md),
        variant === 'panel' && 'w-full rounded-[var(--r-card)] px-6 py-12',
        variant === 'screen' && 'fixed inset-0 z-50',
        // `overlay` fills its nearest positioned ancestor — the skeleton's own wrapper — so the
        // shape stays visible underneath and the mark sits on top of it, centred in both axes like
        // every other variant. (An earlier version pinned it near the top of the surface; on a
        // short panel that put the mark half outside the veil it was supposed to sit in.)
        variant === 'overlay' && 'absolute inset-0 z-10',
        // Blur only where there is something behind to blur. It is what keeps a
        // half-transparent veil reading as depth instead of as two screens fighting.
        covering && 'backdrop-blur-[2px]',
        className
      )}
      // Written as a style rather than an arbitrary Tailwind class so the token does the work:
      // `--loader-backdrop-alpha` is defined once per light/dark in index.css, and a caller who
      // wants a lighter or heavier veil sets that one property — which is why the caller's own
      // style merges on top of this instead of replacing it. See the token for why modes differ.
      style={{
        ...(covering
          ? { backgroundColor: 'hsl(var(--background) / var(--loader-backdrop-alpha))' }
          : null),
        ...style,
      }}
      // One live region for the pair, so a screen reader announces the wait once rather than
      // reading a decorative animation and then its caption.
      role="status"
      aria-live="polite"
      aria-label={label ? undefined : 'Loading'}
      data-test="loader"
      {...props}
    >
      <LoaderMark size={size} speed={speed} />
      {label ? (
        <p className={cn('text-muted-foreground', LABEL[size] ?? LABEL.md)}>{label}</p>
      ) : null}
    </div>
  );
}

/**
 * A loading surface: the skeleton keeps its place and the mark sits over it behind a veil you can
 * see through.
 *
 * This is the shape almost every wait in the app should take, and it replaced an either/or that
 * was never a real choice. A skeleton alone says what is coming but not that anything is
 * happening; the mark alone says something is happening but throws away the shape and, on a page
 * whose content is a table, reads as a whole-page transition for a paginated list. Together, the
 * skeleton is the promise and the mark is the progress.
 *
 * The children are `aria-hidden` and inert — they are a picture of the layout, and a screen
 * reader should hear the one live region the `Loader` provides, not a tree of empty placeholder
 * boxes.
 *
 * For a table, don't wrap the table: a `div` cannot sit inside a `tbody`. Put `position: relative`
 * on the element that holds it and render `<Loader variant="overlay" />` as its sibling.
 *
 * `contentClassName` is what styles the skeletons; `className` styles the box they sit in. The
 * distinction is not pedantry — a caller passing several skeleton blocks wants `space-y-*`
 * *between* them, and on the outer box that utility lands on the wrong pair of elements (the
 * inert wrapper and an absolutely positioned mark) and silently does nothing.
 */
export function LoadingOverlay({
  children,
  size = 'md',
  label = 'Loading…',
  className,
  contentClassName,
  ...props
}) {
  return (
    <div
      // The same height floor the inline variant carries, for the same reason: a two-row skeleton
      // is shorter than the mark that has to sit on top of it, and without this the veil ends
      // above the label. The skeleton keeps its own height whenever it is the taller of the two.
      className={cn('relative', MIN_HEIGHT[size] ?? MIN_HEIGHT.md, className)}
      aria-busy="true"
      data-test="loading-overlay"
    >
      {/* `inert` as well as `aria-hidden`: the placeholders are a picture of the layout, so they
          should be out of the tab order and untouchable, not merely unreadable. React 19 takes
          the boolean directly. */}
      <div className="pointer-events-none select-none" aria-hidden inert>
        <div className={contentClassName}>{children}</div>
      </div>
      <Loader variant="overlay" size={size} label={label} {...props} />
    </div>
  );
}

export default Loader;
