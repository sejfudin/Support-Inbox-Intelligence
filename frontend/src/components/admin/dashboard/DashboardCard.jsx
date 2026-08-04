import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

/**
 * The "?" affordance for a card's `action` slot — explains what a card counts
 * when the kicker alone can't, which on this board usually means "why is this
 * number not scoped to the workspace I picked".
 *
 * `label` names the card in the accessible name because a split panel renders
 * two of these; a screen reader hitting two buttons both called "About this
 * card" cannot tell which half it is on.
 */
export function DashboardCardHelp({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label ? `About ${label}` : 'About this card'}
          className="shrink-0 rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-56">
        <p className="text-xs">{children}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Muted line used when a card has no rows to show for the selected workspace. */
export function DashboardCardEmpty({ children }) {
  return (
    <p className="flex flex-1 items-center text-xs leading-5 text-muted-foreground">{children}</p>
  );
}
