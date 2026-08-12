import { CheckCircle2, ChevronDown, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RequestSeatMeter } from './RequestSeatMeter';
import { RequestEmptySeats, RequestSuggestionCard } from './RequestSuggestionCard';

/**
 * One requested position on leadership's scorecard, as its own collapsible card —
 * the same object the admin works with (`AdminRequestSeatGroup`), minus every
 * control, because nothing on this pane writes.
 *
 * Collapsed by default, and the header has to survive that: the discipline, the
 * technologies asked for, and one line saying how far it has got. Positions
 * nobody has been suggested for are still listed — the gap is the information,
 * and hiding it makes a half-answered request look finished — so "0 of 2 placed ·
 * 2 still to fill" is a header that has done its job.
 *
 * Expansion is owned by the pane rather than the card, so `Collapse all` can mean
 * something.
 */
export function RequestPositionGroup({ row, expanded, onExpandedChange }) {
  const technologies = row.technologies ?? [];
  const emptySeats = Math.max(0, row.wanted - row.suggestions.length);
  const isFilled = row.placed >= row.wanted && row.wanted > 0;

  // Named rather than counted at a single filled seat: "1 of 1 placed · Amina
  // Delić" is the whole story, and there is no list to truncate.
  const solePlacedName =
    row.wanted === 1 && isFilled
      ? row.suggestions.find((suggestion) => suggestion.outcome === 'placed')?.internName
      : null;

  // Leadership's summary, in leadership's terms: placements first, because that
  // is the only number that answers the ask, then who is still being considered.
  // Staged picks are deliberately absent — they are the admin's private draft and
  // this side has never been told about them.
  const summary = [
    `${row.placed} of ${row.wanted} placed`,
    solePlacedName,
    !solePlacedName && row.inSelection > 0 && `${row.inSelection} in selection`,
    !solePlacedName && emptySeats > 0 && `${emptySeats} still to fill`,
  ]
    .filter(Boolean)
    .join(' · ');

  // Finished, or waiting on a decision — and nothing at all on a position nobody
  // has started, where there is no state to flag.
  const marker = isFilled
    ? { Icon: CheckCircle2, className: 'text-[hsl(var(--symphony-placed))]' }
    : row.inSelection > 0
      ? { Icon: CircleAlert, className: 'text-amber-500' }
      : null;

  return (
    <section className="symphony-card-muted overflow-hidden" data-test={`position-group-${row.id}`}>
      <div className="flex items-center gap-3 p-4">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            aria-expanded={expanded}
            className="group flex w-full items-center gap-3 text-left"
            data-test={`position-toggle-${row.id}`}
          >
            {marker ? (
              <marker.Icon
                className={cn('h-5 w-5 shrink-0', marker.className)}
                aria-hidden="true"
              />
            ) : (
              <span className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}

            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-foreground group-hover:underline">
                  {row.name}
                </span>
                {/* What a suggestion for this position gets judged against, kept
                    at header level so a collapsed card still says which
                    discipline it is. */}
                {technologies.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
                  >
                    {name}
                  </span>
                ))}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{summary}</span>
            </span>
          </button>
        </h3>

        <RequestSeatMeter
          wanted={row.wanted}
          putForward={row.putForward}
          inSelection={row.inSelection}
          placed={row.placed}
          showLabel={false}
          className="hidden w-20 shrink-0 sm:block"
        />

        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} who is on ${row.name}`}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          data-test={`position-chevron-${row.id}`}
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/60 p-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {row.suggestions.map((suggestion) => (
              <RequestSuggestionCard key={suggestion.id} suggestion={suggestion} />
            ))}
            {emptySeats > 0 && <RequestEmptySeats count={emptySeats} />}
          </div>
        </div>
      )}
    </section>
  );
}
