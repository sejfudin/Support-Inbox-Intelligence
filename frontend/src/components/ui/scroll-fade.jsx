import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Scroll container that says so: a soft gradient appears at whichever edge has
 * content past it. A pane with its own `overflow-y-auto` inside a page that
 * also scrolls is otherwise invisible — the last row sits flush against the
 * bottom and reads as the end of the list, so nobody scrolls it.
 *
 * The fades are driven by measurement, not by assumption: they only show when
 * the viewport actually overflows, which keeps them off at breakpoints where
 * the caller drops the height cap (`lg:max-h-*`) and the page scrolls instead.
 *
 * @param {string} [viewportClassName]  Classes for the scrolling element — put the
 *                                      height cap and `overflow-y-auto` here.
 * @param {string} [fadeClassName]      Gradient start color; defaults to the app
 *                                      background. Pass the surface the pane
 *                                      actually sits on, or the fade shows as a smudge.
 */
export function ScrollFade({ className, viewportClassName, fadeClassName, children, ...props }) {
  const viewportRef = useRef(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const node = viewportRef.current;
    if (!node) return;
    // Sub-pixel layout leaves scrollHeight a hair over clientHeight on panes
    // that don't really overflow, hence the 1px slack on every comparison.
    const overflows = node.scrollHeight - node.clientHeight > 1;
    setEdges({
      top: overflows && node.scrollTop > 1,
      bottom: overflows && node.scrollTop + node.clientHeight < node.scrollHeight - 1,
    });
  }, []);

  // Re-measures on its own size, its content's size, and on children changing —
  // filtering the list down to two rows has to drop the fade, not leave it
  // hinting at rows that are no longer there.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    Array.from(node.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [measure, children]);

  return (
    <div className={cn('relative', className)} {...props}>
      <div
        ref={viewportRef}
        onScroll={measure}
        className={cn('overscroll-contain', viewportClassName)}
      >
        {children}
      </div>

      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background to-transparent transition-opacity duration-200',
          fadeClassName,
          edges.top ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent transition-opacity duration-200',
          fadeClassName,
          edges.bottom ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}
