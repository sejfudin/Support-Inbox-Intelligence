import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-red-500/15 text-red-800 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/25',
        warning:
          'border-transparent bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/25',
        success:
          'border-transparent bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/25',
        // Fuchsia, matching the attendance calendar's remote-day cell. Deliberately
        // NOT a blue: `default` is `--primary`, which several themes set to a blue
        // or cyan, so a blue "info" would be indistinguishable from it.
        info: 'border-transparent bg-fuchsia-500/15 text-fuchsia-800 hover:bg-fuchsia-500/20 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:hover:bg-fuchsia-500/25',
        outline: 'border-border/60 bg-card text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
