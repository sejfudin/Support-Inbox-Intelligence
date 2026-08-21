import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * A badge: 10.5px/600, radius 6, padding 3px 9px, **sentence case**.
 *
 * Sentence case is not a preference. Uppercase is spoken for elsewhere in this
 * design — page eyebrows and table column heads — so an uppercase badge reads as
 * a column head that wandered into a row. Profile's `ADMIN` / `ACTIVE` pills are
 * the instances this rule exists to retire.
 *
 * Radius 6 (`--r-badge`) and not the pill it used to be: pills are reserved for
 * meters, progress tracks and the switch.
 *
 * `tone` is the API — the six meanings the design has, plus `outline`. `variant`
 * is the older spelling and maps onto the same tones, so existing call sites
 * keep working and there is still only one badge in the app.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-[5px] whitespace-nowrap rounded-[var(--r-badge)] border border-transparent px-[9px] py-[3px] text-[10.5px] font-semibold leading-[1.5] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      tone: {
        success:
          'bg-[hsl(var(--tone-success)/0.15)] text-[hsl(var(--tone-success-fg))] dark:bg-[hsl(var(--tone-success)/0.2)]',
        info: 'bg-[hsl(var(--tone-info)/0.15)] text-[hsl(var(--tone-info-fg))] dark:bg-[hsl(var(--tone-info)/0.2)]',
        warning:
          'bg-[hsl(var(--tone-warning)/0.15)] text-[hsl(var(--tone-warning-fg))] dark:bg-[hsl(var(--tone-warning)/0.2)]',
        error:
          'bg-[hsl(var(--tone-danger)/0.15)] text-[hsl(var(--tone-danger-fg))] dark:bg-[hsl(var(--tone-danger)/0.2)]',
        accent: 'accent-ink bg-primary/10',
        muted: 'bg-muted text-muted-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        // Not one of the six. It exists because the attendance calendar paints
        // its remote-work day cyan, and the badge beside that cell has to be the
        // same colour or the legend stops being a legend.
        cyan: 'bg-[hsl(var(--tone-cyan)/0.15)] text-[hsl(var(--tone-cyan-fg))] dark:bg-[hsl(var(--tone-cyan)/0.2)]',
      },
    },
    defaultVariants: {
      tone: 'muted',
    },
  }
);

/**
 * Old `variant` names → tones. `default` was a filled primary badge, which the
 * design has no slot for; it resolves to the accent tint, its nearest meaning.
 * `info` stays cyan for the calendar reason above.
 */
const VARIANT_TO_TONE = {
  default: 'accent',
  secondary: 'muted',
  destructive: 'error',
  warning: 'warning',
  success: 'success',
  info: 'cyan',
  outline: 'outline',
};

function Badge({
  className,
  tone,
  variant,
  dot = false,
  as: Component = 'div',
  children,
  ...props
}) {
  const resolved = tone ?? VARIANT_TO_TONE[variant] ?? 'muted';

  return (
    <Component className={cn(badgeVariants({ tone: resolved }), className)} {...props}>
      {dot ? (
        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-current" aria-hidden />
      ) : null}
      {children}
    </Component>
  );
}

export { Badge, badgeVariants };
