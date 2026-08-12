import { useState } from 'react';
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
 * One requested position on the admin's work surface. Unfilled positions carry
 * the weight — they are the reason the screen exists — while a position whose
 * seats are all placed collapses to a single line: it is finished, and leaving
 * it expanded pushes the seats that still need someone off the pane.
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

  if (isFilled && !expanded) {
    return (
      <section className="py-3" data-test={`position-group-${row.id}`}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted/50"
          data-test={`position-expand-${row.id}`}
        >
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-[hsl(var(--symphony-placed))]"
            aria-hidden="true"
          />
          <span className="font-semibold text-foreground">{row.name}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {row.placed} of {row.wanted} placed
            {row.suggestions.length > 0 &&
              ` · ${row.suggestions.map((suggestion) => suggestion.internName).join(', ')}`}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </section>
    );
  }

  return (
    <section
      className={cn('space-y-3 py-5', armed && 'rounded-xl bg-[hsl(var(--symphony-brand)/0.04)]')}
      data-test={`position-group-${row.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{row.name}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {row.wanted} wanted
            </span>
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
            {isFilled && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setExpanded(false)}
              >
                Collapse
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
          staged={stagedPicks.length}
          className="w-full max-w-[220px]"
        />
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
    </section>
  );
}
