import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A filter chip: 32px, radius 8, toggles one facet on and off, with its count
 * always to the right of the label.
 *
 * Radius 8 and not the pill it used to be. Chips and filter dropdowns are both
 * radius 8 now, and the caret on a dropdown is the only thing that separates
 * them — which is the point: a chip that was a pill while the dropdown beside it
 * was a rounded rectangle made a toggle look like a menu. Keep chips and
 * dropdowns in separate rows so the caret has something to distinguish against.
 *
 * Pressed state is `aria-pressed`, not a class, so a screen reader gets the same
 * information the tint gives everyone else.
 */
const FilterChip = React.forwardRef(
  ({ label, count, pressed = false, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      className={cn(
        'ui-focus-ring inline-flex h-[var(--h-md)] items-center whitespace-nowrap rounded-[var(--r-control)] border px-[var(--px-md)] text-[length:var(--fs-control)] transition-colors',
        pressed
          ? 'accent-ink border-transparent bg-primary/10 font-semibold'
          : 'border-border bg-card font-medium text-muted-foreground hover:bg-accent',
        className
      )}
      {...props}
    >
      {label ?? children}
      {count != null ? (
        <span
          className={cn(
            'ml-[7px] text-[11px] font-semibold',
            pressed ? 'text-current' : 'text-muted-foreground/75'
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
);
FilterChip.displayName = 'FilterChip';

export { FilterChip };
