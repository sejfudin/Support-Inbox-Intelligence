import { Link } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { getRecommendationStatusLabel } from '@/helpers/recommendations';

const URGENCY_DAYS = 60;

function daysUntil(date) {
  if (!date) return null;
  return differenceInDays(new Date(date), new Date());
}

function pipelineAttentionLabel(item) {
  if (item.reason === 'no_upcoming_interview') {
    return 'No upcoming interview scheduled';
  }
  if (item.reason === 'stalled_recommended') {
    return `Stalled ${item.daysStalled}d in ${getRecommendationStatusLabel(item.status)}`;
  }
  return 'Needs attention';
}

export function DashboardUrgencyStrip({ urgent = [], pipelineAttention = [] }) {
  if (urgent.length === 0 && pipelineAttention.length === 0) {
    return null;
  }

  return (
    <SymphonyCard className="symphony-urgency-card">
      <div className="mb-4 flex items-start gap-3">
        <AlertTriangle className="symphony-urgency-icon mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="symphony-urgency-title text-lg font-semibold">Needs attention</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Programme end dates and stalled placement pipeline items.
          </p>
        </div>
      </div>

      {urgent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Approaching programme end ({URGENCY_DAYS} days)
          </p>
          {urgent.map((candidate) => {
            const days = daysUntil(candidate.expectedEndDate);
            return (
              <Link
                key={candidate.profileId}
                to={`/interns/${candidate.userId}`}
                className="symphony-urgency-row flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-muted/30"
                data-test={`leadership-dashboard-urgent-${candidate.userId}-link`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{candidate.fullname}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {candidate.hub?.name || '—'} · {candidate.programme?.name || '—'}
                  </p>
                </div>
                <span className="symphony-urgency-days shrink-0 text-sm">
                  {days !== null && days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {pipelineAttention.length > 0 && (
        <div className={urgent.length > 0 ? 'mt-4 space-y-2' : 'space-y-2'}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pipeline attention
          </p>
          {pipelineAttention.map((item) => (
            <Link
              key={item.recommendationId}
              to={`/interns/${item.userId}?tab=recommendations`}
              className="symphony-urgency-row flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-muted/30"
              data-test={`leadership-dashboard-pipeline-attention-${item.userId}-link`}
            >
              <p className="truncate font-medium">{item.fullname}</p>
              <span className="symphony-urgency-days shrink-0 text-sm">
                {pipelineAttentionLabel(item)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </SymphonyCard>
  );
}
