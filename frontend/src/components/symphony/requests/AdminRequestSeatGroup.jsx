import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatSuggestionMeta, getInitials } from '@/helpers/staffingRequests';
import { RequestSeatMeter } from './RequestSeatMeter';
import { RequestEmptySeats, RequestSuggestionCard } from './RequestSuggestionCard';

/**
 * A pick that has been staged but never sent. It shows the same skills-and-
 * duration line as everyone else — the candidate under active consideration is
 * the one most in need of comparing — with its unsent state said in words
 * beside them rather than replacing them.
 */
const StagedCard = ({ pick, rejection, onRemove }) => (
  <div
    className={cn(
      'symphony-suggestion symphony-suggestion-staged',
      rejection && 'border-solid border-destructive/60'
    )}
    data-test={`staged-pick-${pick.id}`}
  >
    <span className="symphony-suggestion-avatar" aria-hidden="true">
      {getInitials(pick.name)}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-foreground">{pick.name}</p>
      <p className="text-xs leading-snug text-muted-foreground">
        {[formatSuggestionMeta(pick), 'staged — not sent yet'].filter(Boolean).join(' · ')}
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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={() => onRemove(pick)}
      aria-label={`Remove ${pick.name} from this seat`}
      data-test={`unstage-${pick.id}`}
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </Button>
  </div>
);

/**
 * One requested position on the admin's work surface, as its own card. Each
 * seat is a distinct object rather than a band in a divided list, because this
 * screen is worked position by position — arming one, filling it, moving on —
 * and a run of hairline rules made three seats read as one long form.
 *
 * Every card opens and closes; the header is the toggle and always carries the
 * summary (how many placed, staged and still empty), so a closed card still
 * answers "does this seat need me". What is behind the toggle is the detail:
 * the technologies asked for, who is on it, and the control that arms the rail.
 * A position whose seats are all placed starts closed — it is finished, and
 * leaving it open pushes the seats that still need someone off the pane.
 *
 * Arming a seat filters the candidate rail to it. Which seat is armed is stated
 * here and in the rail's own header; the mock's arrow and its "adjust in the
 * candidate rail" caption are both dropped, because the rail already says it and
 * a UI that narrates itself is a UI that isn't clear enough.
 */
export function AdminRequestSeatGroup({
  row,
  stagedPicks = [],
  rejections = {},
  armed,
  onArm,
  onUnstage,
  canStage,
}) {
  const isFilled = row.placed >= row.wanted && row.wanted > 0;
  const [expanded, setExpanded] = useState(!isFilled);
  const technologies = row.technologies ?? [];
  const emptySeats = Math.max(0, row.wanted - row.suggestions.length - stagedPicks.length);
  const hasRejection = stagedPicks.some((pick) => rejections[pick.id]);

  // A refused pick opens its own card. The refusal names a row, and a row the
  // admin cannot see is the same as no refusal at all.
  useEffect(() => {
    if (hasRejection) setExpanded(true);
  }, [hasRejection]);

  // The one line a closed card has to be worth reading. Staged is named
  // separately from put forward everywhere on this screen — nobody has been
  // offered a staged pick yet.
  const summary = [
    `${row.placed} of ${row.wanted} placed`,
    row.inSelection > 0 && `${row.inSelection} in selection`,
    stagedPicks.length > 0 && `${stagedPicks.length} staged`,
    emptySeats > 0 && `${emptySeats} still to fill`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      className={cn(
        'symphony-card-muted overflow-hidden transition-colors',
        armed && 'border-[hsl(var(--symphony-brand)/0.65)] bg-[hsl(var(--symphony-brand)/0.05)]',
        hasRejection && 'border-destructive/60'
      )}
      data-test={`position-group-${row.id}`}
    >
      <h3>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
          data-test={`position-toggle-${row.id}`}
        >
          {isFilled ? (
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-[hsl(var(--symphony-placed))]"
              aria-hidden="true"
            />
          ) : (
            <span
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-dashed border-border text-[0.5rem] font-bold text-muted-foreground"
              aria-hidden="true"
            >
              {row.wanted}
            </span>
          )}

          <span className="min-w-0 flex-1 space-y-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{row.name}</span>
              {armed && (
                <span className="rounded-full bg-[hsl(var(--symphony-brand)/0.15)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[hsl(var(--symphony-brand-ink))]">
                  Filling now
                </span>
              )}
              {stagedPicks.length > 0 && (
                <span className="rounded-full border border-dashed border-[hsl(var(--symphony-brand)/0.6)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[hsl(var(--symphony-brand-ink))]">
                  {stagedPicks.length} staged
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{summary}</span>
          </span>

          <RequestSeatMeter
            wanted={row.wanted}
            putForward={row.putForward}
            inSelection={row.inSelection}
            placed={row.placed}
            staged={stagedPicks.length}
            showLabel={false}
            className="hidden w-28 shrink-0 sm:block"
          />
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>
      </h3>

      {expanded && (
        <div className="space-y-3 border-t border-border/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {technologies.length > 0 ? (
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
            ) : (
              <p className="text-xs text-muted-foreground">No technologies asked for.</p>
            )}
            {canStage && (
              <Button
                type="button"
                size="sm"
                variant={armed ? 'default' : 'outline'}
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => onArm(armed ? null : row)}
                aria-pressed={armed}
                data-test={`arm-seat-${row.id}`}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                {armed ? 'Filling this seat' : 'Add candidates'}
              </Button>
            )}
          </div>

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
