import { cn } from '@/lib/utils';

/**
 * Shared shell for a dashboard's top-row cards, on both the admin and intern
 * boards. The fixed min-height is what keeps the quarters optically aligned even
 * when one card has fewer rows than its neighbours.
 *
 * Extra props land on the `<section>` so a card can carry a `data-tour` anchor
 * without every caller having to drop down to a raw panel.
 */
export function DashboardCard({
  kicker,
  title,
  action,
  children,
  className,
  contentClassName,
  ...rest
}) {
  return (
    <section
      className={cn('app-panel-soft flex min-h-[12.5rem] flex-col p-4 sm:p-5', className)}
      aria-label={typeof (title || kicker) === 'string' ? title || kicker : undefined}
      {...rest}
    >
      {(kicker || title || action) && (
        <DashboardCardHeader kicker={kicker} title={title} action={action} />
      )}
      {/* min-w-0 is load-bearing: a flex column inside a grid track defaults to
          min-width:auto, so any child that can't shrink (a long unbroken string,
          a wide table) pushes the card past its column instead of wrapping. */}
      <div className={cn('mt-3 flex min-h-0 min-w-0 flex-1 flex-col', contentClassName)}>
        {children}
      </div>
    </section>
  );
}

/**
 * The heading + optional action row. Exported because a split card renders one
 * header per half inside a single panel, so the halves can't go through
 * `DashboardCard` itself without nesting panels.
 *
 * Two heading styles, and they are not interchangeable:
 * - `kicker` — the admin board's small uppercase label. It sits above a big KPI
 *   number that is the real heading, so the label stays quiet.
 * - `title` — the intern board's sentence-case card title. Those cards have no
 *   dominant number to defer to, so the title *is* the heading and reads as one.
 *
 * Pass one or the other, not both.
 */
export function DashboardCardHeader({ kicker, title, action }) {
  return (
    <header className="flex items-start justify-between gap-2">
      {title ? (
        <h2 className="text-sm font-semibold leading-5 text-foreground">{title}</h2>
      ) : (
        kicker && (
          <h2 className="text-[11px] font-semibold uppercase leading-4 tracking-[0.16em] text-muted-foreground">
            {kicker}
          </h2>
        )
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
