import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * One number and what it means: label, value, and a hint saying over what period
 * or against what baseline.
 *
 * `good` paints the value success-green, and it is deliberately opt-in rather
 * than derived from the number: 86% attendance is good news, 86% of a budget
 * spent is not, and the tile cannot tell which it is holding. Green on a number
 * that is merely large is how a dashboard stops meaning anything.
 *
 * The hint is not optional in spirit — a bare "11" tells a reader nothing that
 * "11 · Last 30 days" doesn't tell them better.
 */
function Stat({ label, value, hint, good = false, className, ...props }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-[3px] rounded-[var(--r-card)] border border-border bg-card px-[15px] py-[13px]',
        className
      )}
      {...props}
    >
      <span className="text-[length:var(--fs-hint)] text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-[22px] font-semibold leading-tight tracking-[-0.02em]',
          good ? 'text-[hsl(var(--tone-success-fg))]' : 'text-foreground'
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-[11px] text-muted-foreground/75">{hint}</span> : null}
    </div>
  );
}

/**
 * A progress track: 8px, fully round. One of the three survivors of `--r-pill`,
 * along with the switch — a meter is a length being read, and a squared-off end
 * on a length reads as a bar chart's bar.
 *
 * @param {object} props
 * @param {number} props.value  0–100
 */
function Meter({ value, good = false, label, className, ...props }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('flex h-2 overflow-hidden rounded-[var(--r-pill)] bg-muted', className)}
      {...props}
    >
      <span
        className={cn(
          'transition-[width] duration-300',
          good ? 'bg-[hsl(var(--tone-success-fg))]' : 'bg-primary'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Stat, Meter };
