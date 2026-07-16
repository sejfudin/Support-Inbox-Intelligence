import * as React from 'react';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Textarea that grows to fit its content as the user types (no inner scrollbar),
 * bounded by `maxRows` after which it scrolls. `rows` sets the initial height.
 */
const AutoTextarea = React.forwardRef(
  ({ value, rows = 3, maxRows = 12, className, onChange, ...props }, forwardedRef) => {
    const innerRef = React.useRef(null);
    const setRefs = (node) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      const maxHeight = lineHeight * maxRows;
      const next = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [maxRows]);

    // Resize on mount and whenever the controlled value changes — this covers
    // typing (onChange updates value) and programmatic resets, so onChange
    // doesn't need to resize as well.
    React.useLayoutEffect(() => {
      resize();
    }, [value, resize]);

    return (
      <Textarea
        ref={setRefs}
        rows={rows}
        value={value}
        onChange={onChange}
        className={cn('resize-none', className)}
        {...props}
      />
    );
  }
);
AutoTextarea.displayName = 'AutoTextarea';

export { AutoTextarea };
