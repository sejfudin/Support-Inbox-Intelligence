import { cn } from '@/lib/utils';
import {
  getRequestLockLabel,
  getRequestTotals,
  formatRequestedPositionsSummary,
} from '@/helpers/staffingRequests';
import { SeatMeter } from '@/components/requests/SeatMeter';
import { RequestStatusChip } from '@/components/requests/RequestStatusChip';
import {
  formatDay,
  getNeededBy,
  getRequestBlocker,
  getRequestTitle,
} from '@/components/symphony/requests/requestPresentation';

/**
 * One row in the master list: title and status, what was asked for, the seat
 * meter, and the two facts that decide which request to open next — whether
 * anyone has been offered, and the date.
 *
 * The footer holds one number, not three. `placed · in selection · put forward`
 * were all true and all different, but at card width they ran together into a
 * string nobody read — and the meter above already draws that breakdown, with
 * the full sentence on its `aria-label`. What this card has to answer is "has
 * anyone been offered here yet"; the detail pane is one click away for the rest.
 *
 * A closed card says *how* it ended — "Fulfilled 9 Aug", "Declined 24 Jul" —
 * because those are opposite outcomes and "Closed" collapsed them into one word.
 */
export function RequestCard({ request, selected, onSelect, hasNews = false, stagedCount = 0 }) {
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
        'app-card w-full space-y-2.5 p-3.5 text-left transition-colors',
        'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // A row someone else moved since the last visit is worth spotting from
        // across the list, so the marker is the whole row — accent edge and a
        // tint — not a dot the eye has to hunt for. It stays under the selected
        // treatment so "unread" never reads as "open".
        hasNews && !selected && 'border-l-2 border-l-primary bg-primary/[0.04]',
        selected && 'border-primary/40 bg-primary/[0.06]'
      )}
      data-test={`request-row-${request.id}`}
      data-news={hasNews ? 'true' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[13.5px] font-semibold text-foreground">
            {getRequestTitle(request)}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">
            {formatRequestedPositionsSummary(request.requestedPositions) || 'No positions'}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {/* Deliberately not "New" — the marker fires on notes, put-forwards
              and closures just as much as on filing, and only the request's own
              history can say which. */}
          {hasNews && (
            <span
              className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground"
              data-test="request-news-pill"
            >
              New
            </span>
          )}
          <RequestStatusChip request={request} />
        </span>
      </div>

      <SeatMeter
        wanted={totals.wanted}
        putForward={totals.putForward}
        inSelection={totals.inSelection}
        placed={totals.placed}
        staged={stagedCount}
      />

      <div className="flex items-center justify-between gap-2 border-t border-separator pt-2.5 text-[11.5px]">
        <span className="min-w-0 truncate text-muted-foreground">
          {totals.putForward === 0
            ? 'Nobody put forward'
            : `${totals.putForward} of ${totals.wanted} put forward`}
          {/* Unsent picks are invisible everywhere else once the admin navigates
              away, which is the cart's worst failure mode. */}
          {stagedCount > 0 && (
            <span className="font-semibold text-primary" data-test="request-staged-count">
              {` · ${stagedCount} staged, not sent`}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {blocker && (
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                blocker.tone === 'warning' && 'bg-[hsl(var(--tone-warning))]',
                blocker.tone === 'success' && 'bg-[hsl(var(--tone-success))]',
                blocker.tone === 'info' && 'bg-primary'
              )}
              aria-hidden="true"
            />
          )}
          <span
            className={cn(
              'text-muted-foreground',
              neededBy.overdue && 'font-semibold text-[hsl(var(--tone-danger-fg))]'
            )}
          >
            {isClosed
              ? `${getRequestLockLabel(request)} ${formatDay(request.closedAt) ?? ''}`.trim()
              : neededBy.missing
                ? 'No date'
                : `Needed ${neededBy.short}`}
          </span>
        </span>
      </div>
    </button>
  );
}
