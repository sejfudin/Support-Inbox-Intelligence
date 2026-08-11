import { format } from 'date-fns';
import { History } from 'lucide-react';
import { useStaffingRequestHistory } from '@/queries/staffingRequests';

/**
 * A request's full audit trail — who did what, when. Same data the news badge
 * is derived from (server/services/staffingRequestService.js#getStaffingRequestHistory),
 * already newest-first from the API. Renders nothing while empty rather than
 * an empty "History" section, since a brand-new request has exactly one event.
 */
export function RequestHistoryTrail({ requestId }) {
  const { data: history = [], isPending } = useStaffingRequestHistory(requestId);

  if (isPending || history.length === 0) return null;

  return (
    <section className="space-y-2 border-t border-border/60 pt-4" data-test="request-history">
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        History
      </p>
      <div className="divide-y divide-border/60">
        {history.map((entry) => (
          <div
            key={entry._id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <span className="text-foreground">{entry.action}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {entry.userName} · {format(new Date(entry.timestamp), 'MMM d, yyyy · HH:mm')}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
