import { cn } from '@/lib/utils';
import { RequestSeatMeter } from './RequestSeatMeter';
import { RequestEmptySeats, RequestSuggestionCard } from './RequestSuggestionCard';

/**
 * One requested position: what was asked for, who has been put forward for it,
 * and the seats still empty. Positions nobody has been suggested for are shown
 * too — the gap is the information, and hiding it makes a half-answered request
 * look finished.
 *
 * The requested technologies live on the header because they are what a
 * suggestion gets judged against.
 */
export function RequestPositionGroup({ row }) {
  const technologies = row.technologies ?? [];
  const emptySeats = Math.max(0, row.wanted - row.suggestions.length);

  return (
    <section className="space-y-3 py-5" data-test={`position-group-${row.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{row.name}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {row.wanted} wanted
            </span>
          </div>
          {technologies.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {technologies.map((name) => (
                <li
                  key={name}
                  className="rounded-full border border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <RequestSeatMeter
          wanted={row.wanted}
          putForward={row.putForward}
          inSelection={row.inSelection}
          placed={row.placed}
          className="w-full max-w-[220px]"
        />
      </div>

      <div className={cn('grid gap-2', 'sm:grid-cols-2 xl:grid-cols-3')}>
        {row.suggestions.map((suggestion) => (
          <RequestSuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
        {emptySeats > 0 && <RequestEmptySeats count={emptySeats} />}
      </div>
    </section>
  );
}
