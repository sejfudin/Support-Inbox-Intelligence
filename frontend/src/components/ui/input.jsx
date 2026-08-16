import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A text field, sharing the button's geometry: 32px tall, radius 8, 12px inset.
 * Height comes from `--h-field` rather than `--h-md` only so the Leadership
 * scope can hold its taller inputs without also moving its buttons — everywhere
 * else the two tokens are the same number.
 *
 * `size="sm"` exists for the one case the design has: an input sitting *inside*
 * a table or list row, where it has to be the same 28px as the buttons beside
 * it. Everything else is `md`. There is no `lg` — a taller field buys nothing a
 * wider one doesn't.
 */
const SIZES = {
  sm: 'h-[var(--h-sm)] px-[var(--px-sm)] text-[12px]',
  md: 'h-[var(--h-field)] px-[var(--px-md)] text-[length:var(--fs-control)]',
};

const Input = React.forwardRef(({ className, type, size = 'md', ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'ui-focus-ring flex w-full rounded-[var(--r-control)] border border-border bg-card text-foreground ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/75 disabled:cursor-not-allowed disabled:border-separator disabled:bg-muted disabled:text-muted-foreground',
        SIZES[size] ?? SIZES.md,
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
