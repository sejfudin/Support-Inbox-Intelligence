import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * The dashed "go deeper" tile from the mockup. Dashed rather than solid on
 * purpose: it is a route out of the dashboard, not another metric, and the
 * outline keeps it from competing with the cards that carry real numbers.
 */
export function MoreStatisticsCard() {
  return (
    <Link
      to="/analytics"
      data-test="admin-dashboard-analytics-link"
      className="group flex min-h-[12.5rem] flex-col justify-between rounded-[1.25rem] border border-dashed border-border p-4 transition-colors hover:border-primary/50 hover:bg-primary/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5"
    >
      <span>
        <span className="block text-sm font-semibold leading-5 text-foreground">
          View more statistics
        </span>
        <span className="mt-1.5 block text-[11px] leading-4 text-muted-foreground">
          Throughput, cycle time & workspace trends
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
        Analytics
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
