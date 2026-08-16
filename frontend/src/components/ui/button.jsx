import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * The button. Four looks, three heights, radius 8 always.
 *
 * Every number here is a token — `--h-md`, `--px-md`, `--r-control` — and not a
 * literal, which is the entire mechanism behind the compact density setting: it
 * redefines those tokens on `<html>` and this component follows without knowing
 * the setting exists. A hardcoded `h-8` in here would silently opt every button
 * out of it.
 *
 * Pick the size by container, never by importance:
 *   lg 40 — the one CTA on an empty or auth screen, and a modal's confirm
 *   md 32 — the default: page-header actions, toolbars, filter rows, card heads
 *   sm 28 — inside a table or list row, in popovers and menus
 * Everything in one row is one height. Icon-only buttons are squares of it.
 */
const buttonVariants = cva(
  // Disabled is one look for every variant — sunken fill, hairline border,
  // disabled ink — rather than each variant's own colours at 50% opacity, which
  // is what made a disabled ghost button invisible and a disabled primary still
  // look clickable. It lives in the base string so no variant can forget it.
  'ui-button ui-focus-ring inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-[var(--r-control)] border border-transparent font-medium ring-offset-background transition-colors disabled:pointer-events-none disabled:border-separator disabled:bg-muted disabled:text-muted-foreground/50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border-border bg-transparent text-foreground hover:bg-accent',
        ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        // The Reject half of a decision pair. Quiet at rest — a row full of
        // outlined red buttons reads as a page full of errors — and destructive
        // only once the pointer is on it.
        'ghost-destructive':
          'bg-transparent text-muted-foreground hover:bg-[hsl(var(--tone-danger)/0.12)] hover:text-[hsl(var(--tone-danger-fg))]',
        // Outlined, not filled. A destructive action earns a red *outline*; the
        // filled red is reserved for a view that is itself the confirmation step
        // — see `destructive-solid`.
        destructive:
          'border-[hsl(var(--tone-danger)/0.35)] bg-transparent text-[hsl(var(--tone-danger-fg))] hover:bg-[hsl(var(--tone-danger)/0.12)]',
        'destructive-solid':
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 border-transparent',
        link: 'text-primary underline-offset-4 hover:underline',

        // Legacy aliases. `default` and `outline` predate the library and are
        // still spelled that way at a few hundred call sites; they resolve to
        // the canonical looks above rather than to a second set of styles, so
        // there is exactly one primary button and one secondary button in the
        // app regardless of which name a page happens to use.
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border-border bg-transparent text-foreground hover:bg-accent',
      },
      size: {
        sm: 'h-[var(--h-sm)] px-[var(--px-sm)] text-[12px]',
        md: 'h-[var(--h-md)] px-[var(--px-md)] text-[length:var(--fs-control)]',
        lg: 'h-[var(--h-lg)] px-[var(--px-lg)] text-[13px]',
        // Squares, one per height. Never give an icon-only button a padded size:
        // it ends up a rectangle in a row of squares.
        'icon-sm': 'h-[var(--h-sm)] w-[var(--h-sm)] p-0',
        icon: 'h-[var(--h-md)] w-[var(--h-md)] p-0',
        'icon-lg': 'h-[var(--h-lg)] w-[var(--h-lg)] p-0',

        default: 'h-[var(--h-md)] px-[var(--px-md)] text-[length:var(--fs-control)]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
