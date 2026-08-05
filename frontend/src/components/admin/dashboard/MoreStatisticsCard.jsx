import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * The dashed "go deeper" tile from the mockup. Dashed rather than solid on
 * purpose: it is a route out of the dashboard, not another metric, and the
 * outline keeps it from competing with the cards that carry real numbers.
 *
 * Deliberately a slim strip, not a card: it is a link, and a link needs one row.
 * Given a card's height it had to be a narrow column beside the placement metric,
 * which wrapped its own label onto three lines and clipped the metric's sub-line.
 * Sitting under the metric instead, both get the quarter's full width.
 */
export function MoreStatisticsCard() {
  return (
    <Link
      to="/analytics"
      data-test="admin-dashboard-analytics-link"
      className="group app-panel-soft flex shrink-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">
          View more statistics
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
          Throughput, cycle time &amp; trends
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary">
        Analytics
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
