import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getInitials, formatSuggestionMeta } from '@/helpers/staffingRequests';
import { RequestSeatMeter } from './RequestSeatMeter';
import { getSuggestionState } from './requestPresentation';

const SuggestionCard = ({ suggestion }) => {
  const state = getSuggestionState(suggestion);
  const meta = formatSuggestionMeta(suggestion);

  return (
    <div className="symphony-suggestion" data-test={`suggestion-${suggestion.id}`}>
      <span className="symphony-suggestion-avatar" aria-hidden="true">
        {getInitials(suggestion.internName)}
      </span>
      <div className="min-w-0 flex-1">
        {suggestion.internProfile ? (
          <Link
            to={`/interns/${suggestion.internProfile}`}
            className="truncate text-sm font-semibold text-foreground hover:underline"
          >
            {suggestion.internName}
          </Link>
        ) : (
          <p className="truncate text-sm font-semibold text-foreground">{suggestion.internName}</p>
        )}
        {/* Wraps rather than truncates: at three columns the single line clipped
            the recommendation state ("intervi…"), which is the part that says
            whether this person is actually coming. */}
        <p className="text-xs leading-snug text-muted-foreground">
          {[meta, state.label].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );
};

// One card for the whole gap, not one per seat: eighteen seats produced
// sixteen identical "no one put forward yet" tiles that pushed the actual
// suggestions off the top of the pane. The number is the information — which
// particular empty seat it is never was.
const EmptySeats = ({ count }) => (
  <div className="symphony-seat-empty-card" data-test="empty-seats">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-border text-xs font-semibold">
      +{count}
    </span>
    <p className="text-xs">still to put forward</p>
  </div>
);

/**
 * One requested position: what was asked for, who has been put forward for it,
 * and the seats still empty. Positions nobody has been suggested for are shown
 * too — the gap is the information, and hiding it makes a half-answered request
 * look finished.
 *
 * The requested technologies live on the header because they are what a
 * suggestion gets judged against.
 */
export function RequestPositionGroup({ row, onPutForward }) {
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
            {onPutForward && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => onPutForward(row)}
                data-test={`put-forward-${row.id}`}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Put forward
              </Button>
            )}
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
          <SuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
        {emptySeats > 0 && <EmptySeats count={emptySeats} />}
      </div>
    </section>
  );
}
