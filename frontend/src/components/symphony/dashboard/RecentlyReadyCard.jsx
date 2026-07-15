import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';

export function RecentlyReadyCard({ isPending, recentlyReady = [] }) {
  return (
    <SymphonyCard>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recently ready</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest candidates flagged ready for placement.
          </p>
        </div>
        <Link
          to="/interns?status=ready"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          data-test="leadership-dashboard-recently-ready-link"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isPending && recentlyReady.length === 0 && (
        <p className="text-sm text-muted-foreground">No recently ready candidates.</p>
      )}
      {!isPending && recentlyReady.length > 0 && (
        <div className="space-y-2">
          {recentlyReady.map((candidate) => (
            <Link
              key={candidate.profileId}
              to={`/interns/${candidate.userId}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-4 py-3 transition-colors hover:bg-muted/30"
              data-test={`leadership-dashboard-recent-${candidate.userId}-link`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{candidate.fullname}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {candidate.hub?.name || '—'} · {candidate.programme?.name || '—'}
                </p>
              </div>
              {candidate.readySince && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(candidate.readySince), 'MMM d')}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </SymphonyCard>
  );
}
