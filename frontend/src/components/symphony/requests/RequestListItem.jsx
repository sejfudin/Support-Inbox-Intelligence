import { cn } from '@/lib/utils';
import { getRequestTotals, formatRequestedPositionsSummary } from '@/helpers/staffingRequests';
import { RequestSeatMeter } from './RequestSeatMeter';
import { RequestStatusBadge } from './RequestStatusBadge';
import { formatDay, getNeededBy, getRequestBlocker, getRequestTitle } from './requestPresentation';

/**
 * One row in the master list. Carries the badge, the seat meter and the two
 * dates — enough to trade off which request to open next without opening any of
 * them. A blocker shows as a dot beside the needed-by date rather than repeating
 * the banner text, which only the detail pane has room for.
 */
export function RequestListItem({ request, selected, onSelect }) {
  const totals = getRequestTotals(request);
  const neededBy = getNeededBy(request);
  const blocker = getRequestBlocker(request);
  const isClosed = request.status === 'closed';

  return (
    <button
      type="button"
      onClick={() => onSelect(request.id)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'symphony-card-muted w-full space-y-3 p-4 text-left transition-colors',
        'hover:border-[hsl(var(--symphony-brand)/0.45)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--symphony-brand))]',
        selected && 'symphony-list-item-active'
      )}
      data-test={`request-row-${request.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-semibold text-foreground">{getRequestTitle(request)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatRequestedPositionsSummary(request.requestedPositions) || 'No positions'}
          </p>
        </div>
        <RequestStatusBadge request={request} className="shrink-0 px-2.5 py-0.5 text-xs" />
      </div>

      <RequestSeatMeter
        wanted={totals.wanted}
        putForward={totals.putForward}
        placed={totals.placed}
        showLabel={false}
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {totals.placed}/{totals.wanted} placed
          {totals.putForward > totals.placed && ` · ${totals.putForward} suggested`}
        </span>
        <span className="flex items-center gap-1.5">
          {blocker && (
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                blocker.tone === 'warning' && 'bg-[hsl(38_92%_50%)]',
                blocker.tone === 'success' && 'bg-[hsl(152_55%_45%)]',
                blocker.tone === 'info' && 'bg-[hsl(var(--symphony-brand))]'
              )}
              aria-hidden="true"
            />
          )}
          {/* `symphony-date-urgent` is the app's existing urgency treatment —
              using it alone rather than layering a red on top, which only
              produced two competing colours. Overdue is additionally carried by
              the dot to its left and the banner in the detail pane. */}
          <span className={cn('text-muted-foreground', neededBy.overdue && 'symphony-date-urgent')}>
            {isClosed
              ? `Closed ${formatDay(request.closedAt) ?? ''}`
              : neededBy.missing
                ? 'No date'
                : `Needed ${neededBy.short}`}
          </span>
        </span>
      </div>
    </button>
  );
}
