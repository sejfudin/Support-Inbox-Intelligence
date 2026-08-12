import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatSuggestionMeta, getInitials } from '@/helpers/staffingRequests';
import { getAvatarColor } from '@/helpers/avatarColor';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { RequestSeatMeter } from './RequestSeatMeter';
import {
  RequestEmptySeats,
  RequestSuggestionCard,
  SuggestionStatePill,
} from './RequestSuggestionCard';

/**
 * A pick that has been staged but never sent. It shows the same skills-and-
 * duration line as everyone else — the candidate under active consideration is
 * the one most in need of comparing — and keeps the dashed border to itself:
 * of everyone on this card it is the only one the admin can still take back.
 */
const StagedCard = ({ pick, rejection, onRemove }) => (
  <div
    className={cn(
      'symphony-suggestion symphony-suggestion-staged',
      rejection && 'border-solid border-destructive/60'
    )}
    data-test={`staged-pick-${pick.id}`}
  >
    <span
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold',
        getAvatarColor(pick.name)
      )}
      aria-hidden="true"
    >
      {getInitials(pick.name)}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-foreground">{pick.name}</p>
      <p className="truncate text-xs leading-snug text-muted-foreground">
        {formatSuggestionMeta(pick)}
      </p>
      {/* A stale pick reports against its own row: the admin drops this one and
          submits the rest, rather than being told the whole cart was wrong. */}
      {rejection && (
        <p
          className="mt-1 flex items-start gap-1.5 text-xs font-medium leading-snug text-destructive"
          data-test={`staged-pick-rejection-${pick.id}`}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {rejection}
        </p>
      )}
    </div>
    <SuggestionStatePill label="Staged" />
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={() => onRemove(pick)}
      aria-label={`Remove ${pick.name} from this position`}
      data-test={`unstage-${pick.id}`}
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </Button>
  </div>
);

/**
 * One requested position on the admin's work surface, as its own card. Each
 * position is a distinct object rather than a band in a divided list, because
 * this screen is worked position by position — open the picker, fill it, move on
 * — and a run of hairline rules made three positions read as one long form.
 *
 * The header answers the whole question while closed: the discipline, the
 * technologies asked for, how far along it is, and the one action that moves it.
 * `Add candidates` sits up here rather than behind the toggle — it is the point
 * of the card, and a primary action hidden by default is not a primary action.
 * What the toggle hides is only the roster: who is on it and who is missing.
 *
 * Expansion is owned by the pane, not the card, so `Collapse all` can mean
 * something and a card holding a refused pick can be forced open.
 */
export function AdminRequestSeatGroup({
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
  const isFilled = row.placed >= row.wanted && row.wanted > 0;
  const technologies = row.technologies ?? [];
  const emptySeats = Math.max(0, row.wanted - row.suggestions.length - stagedPicks.length);
  const hasRejection = stagedPicks.some((pick) => rejections[pick.id]);

  // Named rather than counted when there is exactly one seat and it is filled:
  // "1 of 1 placed · Amina Delić" is the whole story of that position, and at one
  // seat there is no list to truncate.
  const solePlacedName =
    row.wanted === 1 && isFilled
      ? row.suggestions.find((suggestion) => suggestion.outcome === 'placed')?.internName
      : null;

  // The one line a closed card has to be worth reading. Staged is named
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

  // Two markers, and only where they say something the summary cannot: finished,
  // or waiting on a decision that is not the admin's to make. A position nobody
  // has started on carries neither — there is nothing to flag about untouched
  // work.
  const marker = isFilled
    ? { Icon: CheckCircle2, className: 'text-[hsl(var(--symphony-placed))]' }
    : row.inSelection > 0
      ? { Icon: CircleAlert, className: 'text-amber-500' }
      : null;

  return (
    <section
      className={cn(
        'symphony-card-muted overflow-hidden transition-colors',
        hasRejection && 'border-destructive/60'
      )}
      data-test={`position-group-${row.id}`}
    >
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
                {/* The brief, at header level: a closed card still says which
                    discipline this is, which is what the pane is scanned for. */}
                {technologies.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
                  >
                    <TechnologyIcon
                      technology={technologyIndex?.get(name.toLowerCase())}
                      size={11}
                      className="shrink-0"
                    />
                    {name}
                  </span>
                ))}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{summary}</span>
            </span>
          </button>
        </h3>

        {canStage && (
          <Button
            type="button"
            size="sm"
            variant={isFilled ? 'outline' : 'default'}
            className="h-8 shrink-0 gap-1.5 px-3 text-xs font-semibold"
            onClick={() => onArm(row)}
            data-test={`arm-seat-${row.id}`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add candidates
          </Button>
        )}

        <RequestSeatMeter
          wanted={row.wanted}
          putForward={row.putForward}
          inSelection={row.inSelection}
          placed={row.placed}
          staged={stagedPicks.length}
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
          {technologies.length === 0 && (
            <p className="mb-3 text-xs text-muted-foreground">No technologies asked for.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {row.suggestions.map((suggestion) => (
              <RequestSuggestionCard key={suggestion.id} suggestion={suggestion} />
            ))}
            {stagedPicks.map((pick) => (
              <StagedCard
                key={pick.id}
                pick={pick}
                rejection={rejections[pick.id]}
                onRemove={() => onUnstage(row.id, pick)}
              />
            ))}
            {emptySeats > 0 && <RequestEmptySeats count={emptySeats} />}
          </div>
        </div>
      )}
    </section>
  );
}
