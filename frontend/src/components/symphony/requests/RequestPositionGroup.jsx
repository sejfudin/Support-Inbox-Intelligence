import { getSolePlacedName } from '@/helpers/staffingRequests';
import { RequestPositionCard } from './RequestPositionCard';
import { RequestEmptySeats, RequestSuggestionCard } from './RequestSuggestionCard';

/**
 * One requested position on leadership's scorecard — the same object the admin
 * works with (`AdminRequestSeatGroup`), minus every control, because nothing on
 * this pane writes.
 *
 * The card chrome is `RequestPositionCard`; what belongs to this side is the
 * summary wording and the roster. Positions nobody has been suggested for are
 * still listed: the gap is the information, and hiding it makes a half-answered
 * request look finished.
 *
 * Expansion is owned by the pane rather than the card, so `Collapse all` can mean
 * something.
 */
export function RequestPositionGroup({ row, expanded, onExpandedChange }) {
  const emptySeats = Math.max(0, row.wanted - row.suggestions.length);
  const solePlacedName = getSolePlacedName(row);

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

  return (
    <RequestPositionCard
      row={row}
      summary={summary}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {row.suggestions.map((suggestion) => (
          <RequestSuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
        {emptySeats > 0 && <RequestEmptySeats count={emptySeats} />}
      </div>
    </RequestPositionCard>
  );
}
