import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { getRecommendationResultLabel } from '@/helpers/recommendations';
import { cn } from '@/lib/utils';

function OutcomeBadge({ outcome }) {
  const isPlaced = outcome === 'placed';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
        isPlaced
          ? 'border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'border border-border bg-muted/40 text-muted-foreground'
      )}
    >
      {getRecommendationResultLabel(outcome)}
    </span>
  );
}

export function RecentOutcomesCard({ isPending, recentOutcomes = [] }) {
  return (
    <SymphonyCard>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Recent outcomes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest placement results from recommendation pipeline.
        </p>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isPending && recentOutcomes.length === 0 && (
        <p className="text-sm text-muted-foreground">No placement outcomes recorded yet.</p>
      )}
      {!isPending && recentOutcomes.length > 0 && (
        <div className="space-y-2">
          {recentOutcomes.map((outcome) => (
            <Link
              key={outcome.recommendationId}
              to={`/interns/${outcome.userId}?tab=recommendations`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-4 py-3 transition-colors hover:bg-muted/30"
              data-test={`leadership-dashboard-outcome-${outcome.userId}-link`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{outcome.fullname}</p>
                {outcome.company && (
                  <p className="truncate text-xs text-muted-foreground">{outcome.company}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <OutcomeBadge outcome={outcome.outcome} />
                {outcome.decidedAt && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(outcome.decidedAt), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </SymphonyCard>
  );
}
