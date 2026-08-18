import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The segmented control: a sunken track with a raised thumb on the selected item.
 *
 * Use it when the control changes **how one dataset is drawn** — Month summary /
 * By day, List / Board. When it changes **what the page is**, that is `Tabs`.
 * The app had three separate builds of this at three different radii; this is
 * the only one, at radius 8 for the track and 6 for the thumb.
 *
 * The thumb is a fixed 28px rather than `--h-sm`: the track is 2px of padding
 * around it, so tying it to a token that compact mode moves would leave the
 * track and the thumb disagreeing about their shared border-radius inset.
 *
 * Radio semantics, so arrow keys move between options the way a segmented
 * control is expected to behave.
 *
 * @param {object} props
 * @param {Array<{value: string, label: string, icon?: React.ComponentType,
 *   disabled?: boolean, dataTest?: string}>} props.items
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.label]   accessible name for the group
 * @param {boolean} [props.collapseLabels]  below `sm`, show only the icons
 *   Opt-in, and only sound when the icons genuinely stand alone — List vs Board
 *   do; Light / Dark / System do not, because a sun and a monitor do not say
 *   "this one is the default" on their own.
 */
function Switcher({
  items,
  value,
  onChange,
  label = 'View',
  collapseLabels = false,
  className,
  ...props
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex gap-[2px] rounded-[var(--r-control)] bg-muted p-[2px]', className)}
      {...props}
    >
      {items.map((item) => {
        const selected = item.value === value;
        const Icon = item.icon;

        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={item.disabled}
            data-test={item.dataTest}
            onClick={() => onChange?.(item.value)}
            className={cn(
              'ui-focus-ring flex h-[28px] items-center gap-1.5 whitespace-nowrap rounded-[var(--r-badge)] px-[var(--px-md)] text-[length:var(--fs-control)] transition-colors disabled:pointer-events-none disabled:opacity-50',
              selected
                ? 'bg-card font-semibold text-foreground shadow-elevated-sm'
                : 'font-medium text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon ? <Icon className="h-[14px] w-[14px]" strokeWidth={1.8} aria-hidden /> : null}
            <span className={cn(Icon && collapseLabels && 'hidden sm:inline')}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { Switcher };
