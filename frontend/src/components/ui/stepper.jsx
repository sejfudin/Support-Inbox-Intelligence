import * as React from 'react';
import { Minus, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A small number picker — 120px wide, the control height tall, with a −/+ on
 * either side of the value. For bounded counts a text input would over-serve:
 * "days per request" is a number between 1 and 30, not free text.
 *
 * The buttons are `-`/`+` in that order because the value reads left to right
 * between them; swapping them is a reliable way to get a mis-click.
 *
 * @param {object} props
 * @param {number} props.value
 * @param {(value: number) => void} props.onChange
 * @param {number} [props.min]
 * @param {number} [props.max]
 * @param {number} [props.step]
 */
function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  label = 'Value',
  disabled = false,
  className,
  ...props
}) {
  const clamp = (next) => Math.min(max, Math.max(min, next));
  const atMin = value <= min;
  const atMax = value >= max;

  const stepButton =
    'ui-focus-ring grid h-full w-[30px] shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:text-muted-foreground/40';

  return (
    <div
      className={cn(
        'flex h-[var(--h-md)] w-[120px] items-center overflow-hidden rounded-[var(--r-control)] border border-border bg-card',
        disabled && 'bg-muted text-muted-foreground/50',
        className
      )}
      {...props}
    >
      <button
        type="button"
        className={stepButton}
        onClick={() => onChange?.(clamp(value - step))}
        disabled={disabled || atMin}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <span
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        className="flex-1 text-center text-[13px] font-semibold tabular-nums text-foreground"
      >
        {value}
      </span>
      <button
        type="button"
        className={stepButton}
        onClick={() => onChange?.(clamp(value + step))}
        disabled={disabled || atMax}
        aria-label={`Increase ${label}`}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

export { Stepper };
