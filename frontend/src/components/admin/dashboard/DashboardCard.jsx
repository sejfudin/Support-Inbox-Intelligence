import { cn } from '@/lib/utils';

/**
 * Shared shell for the admin dashboard's top row. The fixed min-height is what
 * keeps the four quarters optically aligned even when one card has fewer rows
 * than its neighbours.
 */
export function DashboardCard({ kicker, action, children, className, contentClassName }) {
  return (
    <section
      className={cn('app-panel-soft flex min-h-[12.5rem] flex-col p-4 sm:p-5', className)}
      aria-label={typeof kicker === 'string' ? kicker : undefined}
    >
      {(kicker || action) && <DashboardCardHeader kicker={kicker} action={action} />}
      <div className={cn('mt-3 flex min-h-0 flex-1 flex-col', contentClassName)}>{children}</div>
    </section>
  );
}

/**
 * The kicker + optional action row. Exported because a split card renders one
 * header per half inside a single panel, so the halves can't go through
 * `DashboardCard` itself without nesting panels.
 */
export function DashboardCardHeader({ kicker, action }) {
  return (
    <header className="flex items-start justify-between gap-2">
      {kicker && (
        <h2 className="text-[11px] font-semibold uppercase leading-4 tracking-[0.16em] text-muted-foreground">
          {kicker}
        </h2>
      )}
      {action}
    </header>
  );
}

/** Muted line used when a card has no rows to show for the selected workspace. */
export function DashboardCardEmpty({ children }) {
  return (
    <p className="flex flex-1 items-center text-xs leading-5 text-muted-foreground">{children}</p>
  );
}
