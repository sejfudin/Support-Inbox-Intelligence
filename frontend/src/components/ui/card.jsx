import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The panel shell every section in the app is built from: surface, one 1px
 * outline, radius 12, and `overflow-hidden` so a table's head band and a footer
 * tint clip to the corners instead of squaring them off.
 *
 * The header and footer paddings come from `--card-pad` and the row rhythm, so a
 * card tightens with the density setting without either of them naming a number.
 *
 * `.app-card` in `index.css` is the same shell as a single utility class, for the
 * many sections that need the box and none of the sub-parts.
 */
const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'overflow-hidden rounded-[var(--r-card)] border border-border bg-card text-card-foreground',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

/**
 * A stack, not a row — a header here holds a title over a description, and the
 * auth screens put a brand mark above both. The library's *banded* header, with
 * the title, sub and actions side by side under a hairline, is `.app-card-head`
 * in `index.css`; that is a different thing and pages opt into it.
 */
const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1.5 p-[var(--card-pad)]', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'text-[length:var(--fs-card-title)] font-semibold leading-tight text-foreground',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-[length:var(--fs-control)] text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

/** `pt-0` because a header sits directly above it and already paid the top gap. */
const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-[var(--card-pad)] pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center gap-[var(--control-gap)] p-[var(--card-pad)] pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
