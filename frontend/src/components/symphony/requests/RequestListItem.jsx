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
export function RequestListItem({ request, selected, onSelect, hasNews = false, stagedCount = 0 }) {
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
        // A row someone else moved since the last visit is worth spotting from
        // across the list, so the marker is the whole row — accent edge and a
        // tint — not a dot the eye has to hunt for. The tint stays under the
        // selected treatment so "unread" never reads as "open".
        hasNews &&
          !selected &&
          'border-l-2 border-l-[hsl(var(--symphony-brand))] bg-[hsl(var(--symphony-brand)/0.06)]',
        selected && 'symphony-list-item-active'
      )}
      data-test={`request-row-${request.id}`}
      data-news={hasNews ? 'true' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-semibold text-foreground">{getRequestTitle(request)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatRequestedPositionsSummary(request.requestedPositions) || 'No positions'}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {/* Deliberately not "New" — the marker fires on notes, put-forwards
              and closures just as much as on filing, and only the request's
              own history can say which. */}
          {hasNews && (
            <span
              className="rounded-full bg-[hsl(var(--symphony-brand))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              data-test="request-news-pill"
            >
              New activity
            </span>
          )}
          <RequestStatusBadge request={request} className="px-2.5 py-0.5 text-xs" />
        </span>
      </div>

      <RequestSeatMeter
        wanted={totals.wanted}
        putForward={totals.putForward}
        inSelection={totals.inSelection}
        placed={totals.placed}
        staged={stagedCount}
        showLabel={false}
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        {/* Each number is named. `wanted` is already on the row above, as the
            per-position summary ("2 Frontend Developer, 1 QA Engineer"), so it
            is not repeated here — but placed, in selection and put forward all
            are, because no two of them mean the same thing and a row that
            collapses them cannot say whether anyone is still coming. */}
        <span className="text-muted-foreground">
          {totals.putForward === 0
            ? 'Nobody put forward'
            : `${totals.placed} placed · ${totals.inSelection} in selection · ${totals.putForward} put forward`}
          {/* Unsent picks are invisible everywhere else once the admin
              navigates away, which is the cart's worst failure mode. */}
          {stagedCount > 0 && (
            <span
              className="font-semibold text-[hsl(var(--symphony-brand-ink))]"
              data-test="request-staged-count"
            >
              {` · ${stagedCount} staged, not sent`}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {blocker && (
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                blocker.tone === 'warning' && 'bg-[hsl(var(--symphony-warning))]',
                blocker.tone === 'success' && 'bg-[hsl(var(--symphony-placed))]',
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
