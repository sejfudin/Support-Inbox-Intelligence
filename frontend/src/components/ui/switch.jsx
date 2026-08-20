import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A two-state switch: 38×22 pill track, 18px knob. Hand-rolled rather than
 * pulling in `@radix-ui/react-switch` — it is a button with `role="switch"` and
 * one piece of state, and the package list is long enough already.
 *
 * Keyboard and screen-reader behaviour comes from the role plus `aria-checked`,
 * which is what Radix's own switch resolves to; Space and Enter activate it
 * because it is a real `<button>`.
 *
 * One of the three places `--r-pill` survives — the toggle, the meter and the
 * progress track. Its size is fixed rather than tokenised: a 38×22 toggle is
 * already at the small end, and compact density must not shrink a hit target
 * this size any further.
 */
const Switch = React.forwardRef(
  ({ className, checked = false, onCheckedChange, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'ui-focus-ring inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-[var(--r-pill)] border border-transparent p-[2px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block h-[18px] w-[18px] rounded-full bg-card shadow-elevated-sm transition-transform',
          checked ? 'translate-x-[16px]' : 'translate-x-0'
        )}
      />
    </button>
  )
);
Switch.displayName = 'Switch';

export { Switch };
