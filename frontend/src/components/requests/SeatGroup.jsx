import { CheckCircle2, ChevronDown, CircleAlert, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { getSolePlacedName } from '@/helpers/staffingRequests';
import { SeatMeter } from '@/components/requests/SeatMeter';
import {
  CandidateRow,
  EmptySeatsRow,
  StagedCandidateRow,
} from '@/components/requests/CandidateRow';

/**
 * One requested position on the admin's work surface — the discipline, its
 * technologies, how full it is, and the roster behind a chevron.
 *
 * Each position is a distinct card rather than a band in a divided list, because
 * this screen is worked position by position — open the picker, fill it, move on
 * — and a run of hairline rules made three positions read as one long form.
 *
 * `Add candidates` sits in the header rather than behind the toggle: it is the
 * point of the card, and a primary action hidden by default is not a primary
 * action. It is outlined, not filled — there is one filled action on this pane,
 * `Submit to leadership`, and a request with four positions would otherwise put
 * four accent buttons above it, none of which sends anything.
 *
 * Expansion is owned by the pane, not the card, so `Collapse all` can mean
 * something and a card holding a refused pick can be forced open.
 */
export function SeatGroup({
  row,
  stagedPicks = [],
  rejections = {},
  expanded,
  onExpandedChange,
  onArm,
  onUnstage,
  canStage,
  technologyIndex,
}) {
  const technologies = row.technologies ?? [];
  const emptySeats = Math.max(0, row.wanted - row.suggestions.length - stagedPicks.length);
  const hasRejection = stagedPicks.some((pick) => rejections[pick.id]);
  const solePlacedName = getSolePlacedName(row);
  const isFilled = row.placed >= row.wanted && row.wanted > 0;

  // "Filled" and "waiting on a decision" are the two states worth flagging; a
  // position nobody has started carries neither, since there is nothing to flag
  // about untouched work.
  const marker = isFilled
    ? { Icon: CheckCircle2, className: 'text-[hsl(var(--tone-success-fg))]' }
    : row.inSelection > 0
      ? { Icon: CircleAlert, className: 'text-[hsl(var(--tone-warning-fg))]' }
      : null;

  // The one line a collapsed card has to be worth reading. Staged is named
  // separately from put forward everywhere on this screen — nobody has been
  // offered a staged pick yet.
  const summary = [
    `${row.placed} of ${row.wanted} placed`,
    solePlacedName,
    !solePlacedName && row.inSelection > 0 && `${row.inSelection} awaiting leadership`,
    stagedPicks.length > 0 && `${stagedPicks.length} staged`,
    !solePlacedName && emptySeats > 0 && `${emptySeats} still to fill`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    // A card holding a refused pick outlines itself, so the admin can find the
    // one that needs attention without opening every card on the pane.
    <section
      className={cn(
        'overflow-hidden rounded-[var(--r-card)] border border-border bg-card transition-colors',
        hasRejection && 'border-destructive/60'
      )}
      data-test={`position-group-${row.id}`}
    >
      <div className="flex items-center gap-3 p-3.5">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            aria-expanded={expanded}
            className="group flex w-full items-center gap-2.5 text-left"
            data-test={`position-toggle-${row.id}`}
          >
            {/* The empty span holds the marker's place, so a position with no
                state to flag doesn't sit 20px left of its neighbours. */}
            {marker ? (
              <marker.Icon
                className={cn('h-4 w-4 shrink-0', marker.className)}
                aria-hidden="true"
              />
            ) : (
              <span className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}

            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13.5px] font-semibold text-foreground group-hover:underline">
                  {row.name}
                </span>
                {/* The brief at header level, so a collapsed card still says which
                    stack it is — that is what the pane gets scanned for. */}
                {technologies.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {technologyIndex && (
                      <TechnologyIcon
                        technology={technologyIndex.get(name.toLowerCase())}
                        size={11}
                        className="shrink-0"
                      />
                    )}
                    {name}
                  </span>
                ))}
              </span>
              <span className="block truncate text-[12px] text-muted-foreground">{summary}</span>
            </span>
          </button>
        </h3>

        {/* Meter before the action: how full the seat is, then the control that
            fills it. The other order put a button between the summary and the
            count it summarises. */}
        <SeatMeter
          wanted={row.wanted}
          putForward={row.putForward}
          inSelection={row.inSelection}
          placed={row.placed}
          staged={stagedPicks.length}
          className="hidden w-20 shrink-0 sm:flex"
        />

        {canStage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 px-3 text-[12px] font-semibold"
            onClick={() => onArm(row)}
            data-test={`arm-seat-${row.id}`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add candidates
          </Button>
        )}

        {/* A second target for the same toggle: the header button is the
            accessible one, this is the one people aim at. */}
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} who is on ${row.name}`}
          className="shrink-0 rounded-[var(--r-control)] p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          data-test={`position-chevron-${row.id}`}
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-separator p-3.5">
          {technologies.length === 0 && (
            <p className="mb-3 text-[12px] text-muted-foreground">No technologies asked for.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {row.suggestions.map((suggestion) => (
              <CandidateRow key={suggestion.id} suggestion={suggestion} />
            ))}
            {stagedPicks.map((pick) => (
              <StagedCandidateRow
                key={pick.id}
                pick={pick}
                rejection={rejections[pick.id]}
                onRemove={() => onUnstage(row.id, pick)}
              />
            ))}
            {emptySeats > 0 && <EmptySeatsRow count={emptySeats} />}
          </div>
        </div>
      )}
    </section>
  );
}
