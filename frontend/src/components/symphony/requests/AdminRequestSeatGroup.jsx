import { AlertTriangle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatSuggestionMeta, getInitials, getSolePlacedName } from '@/helpers/staffingRequests';
import { getAvatarColor } from '@/helpers/avatarColor';
import { RequestPositionCard } from './RequestPositionCard';
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
          className="mt-1 flex items-start gap-1.5 text-xs font-medium leading-snug text-[hsl(var(--tone-danger-fg))]"
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
 * One requested position on the admin's work surface. Each position is a distinct
 * object rather than a band in a divided list, because this screen is worked
 * position by position — open the picker, fill it, move on — and a run of hairline
 * rules made three positions read as one long form.
 *
 * The card chrome is `RequestPositionCard`, shared with leadership's read-only
 * view. What belongs to this side is the summary wording (staged picks are named
 * here and nowhere else), the `Add candidates` action, and a roster that includes
 * picks not yet sent. `Add candidates` sits in the header rather than behind the
 * toggle — it is the point of the card, and a primary action hidden by default is
 * not a primary action.
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
  const technologies = row.technologies ?? [];
  const emptySeats = Math.max(0, row.wanted - row.suggestions.length - stagedPicks.length);
  const hasRejection = stagedPicks.some((pick) => rejections[pick.id]);
  const solePlacedName = getSolePlacedName(row);

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

  // A card holding a refused pick outlines itself, so the admin can find the one
  // that needs attention without opening every card on the pane.
  return (
    <RequestPositionCard
      row={row}
      summary={summary}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      staged={stagedPicks.length}
      technologyIndex={technologyIndex}
      className={cn('transition-colors', hasRejection && 'border-destructive/60')}
      action={
        canStage && (
          // Outlined whether or not the seat is filled. There is one primary
          // action on this pane — `Submit to leadership` — and a request with four
          // positions used to put four solid brand buttons above it, none of which
          // sends anything. Staging is the step before the action, so it wears the
          // secondary weight.
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1.5 px-3 text-xs font-semibold"
            onClick={() => onArm(row)}
            data-test={`arm-seat-${row.id}`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add candidates
          </Button>
        )
      }
    >
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
    </RequestPositionCard>
  );
}
