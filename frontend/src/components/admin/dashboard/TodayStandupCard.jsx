import { Link } from 'react-router-dom';
import { NotebookPen, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Today's standup coverage for the selected workspace. Reuses the existing
 * admin standup-compliance endpoint (`GET /api/dailies/admin/overview`) rather
 * than duplicating the numbers into the dashboard aggregate.
 */
export function TodayStandupCard({ overview, isPending }) {
  const stats = overview?.stats;
  const isWeekend = overview?.today?.isWeekend;
  const reported = stats?.reportedToday ?? 0;
  const total = stats?.totalInterns ?? 0;
  const openBlockers = stats?.openBlockers ?? 0;

  return (
    <section
      className="app-panel-soft flex min-h-0 flex-1 flex-col p-4 sm:p-5"
      aria-label="Today's standup"
    >
      <header className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-6 text-foreground">Today&apos;s standup</h2>
        {!isPending && isWeekend && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Weekend
          </span>
        )}
      </header>

      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <NotebookPen className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          {isPending ? (
            <>
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-muted" />
            </>
          ) : (
            <>
              <p className="text-sm font-semibold leading-5 text-foreground">
                {reported} / {total} notes in
              </p>
              <p className="truncate text-[11px] leading-4 text-muted-foreground">
                {total === 0 ? 'No interns to report' : `${total - reported} still to report today`}
              </p>
            </>
          )}
        </div>
      </div>

      {!isPending && openBlockers > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-500">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {openBlockers} open {openBlockers === 1 ? 'blocker' : 'blockers'}
        </p>
      )}

      {/* mt-auto keeps the button on the card's bottom edge when the rail has
          spare height, so it lines up with the interns panel's footer. */}
      <div className="mt-auto pt-4">
        <Button asChild size="sm" className="w-full">
          <Link to="/admin/daily-insights" data-test="admin-dashboard-standup-link">
            Open standup board
          </Link>
        </Button>
      </div>
    </section>
  );
}
