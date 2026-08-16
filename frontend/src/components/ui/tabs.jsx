'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

/**
 * Page tabs — the underline kind, 40px tall, sitting on a hairline.
 *
 * Tabs and `Switcher` are not interchangeable and the difference is what the
 * control changes, not how it looks:
 *
 *   Tabs     change **what the page is**       — Queue / Request limits
 *   Switcher changes **how one dataset is drawn** — Month summary / By day
 *
 * If the heading and the data both change, it is tabs. If the same rows are
 * redrawn a second way, it is a switcher. Getting this backwards is why the app
 * ended up with three segmented controls and two tab strips.
 *
 * The active tab is marked by an inset underline rather than a border on the
 * element, so switching tabs never shifts the row by a pixel.
 */
const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('flex items-center gap-1 border-b border-separator', className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'ui-focus-ring inline-flex h-10 items-center whitespace-nowrap px-[var(--px-md)] text-[length:var(--fs-control)] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * The count beside a tab label. Tertiary at rest, accent ink when its tab is
 * active — `.accent-ink` rather than `text-primary` so it stays legible on a
 * light surface in every one of the palettes.
 */
const TabsCount = React.forwardRef(({ className, ...props }, ref) => (
  <span ref={ref} className={cn('ui-tab-count', className)} {...props} />
));
TabsCount.displayName = 'TabsCount';

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-[var(--stack-gap)] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsCount, TabsContent };
