import { cn } from '@/lib/utils';
import { InternPanel } from '@/components/interns/InternPanel';

/**
 * The section shell every block on "My progress" sits in — titled header with a
 * sentence of context, then the body.
 *
 * Same shape as the panels on `/my-technologies` (`InternPanel` with a bordered
 * header strip) rather than the dashboard's `DashboardCard`: this is a full-width
 * reading page, not a grid of quarter-width cards, so the headings are section
 * headings and the body is free to be as tall as its content.
 */
export function ProgressPanel({ title, description, action, children, className, dataTour }) {
  return (
    <InternPanel className={cn('overflow-hidden p-0 md:p-0', className)} data-tour={dataTour}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4 md:px-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </InternPanel>
  );
}

/** The muted line a section shows when the programme has nothing recorded yet. */
export function ProgressPanelEmpty({ children }) {
  return <p className="px-5 py-6 text-sm leading-6 text-muted-foreground md:px-6">{children}</p>;
}

/** Standard body padding, for sections that aren't a full-bleed list. */
export function ProgressPanelBody({ children, className }) {
  return <div className={cn('px-5 py-5 md:px-6', className)}>{children}</div>;
}
