import { Link } from 'react-router-dom';
import { formatSuggestionMeta, getInitials } from '@/helpers/staffingRequests';
import { getSuggestionState } from './requestPresentation';

/**
 * One intern already put forward for a requested position. Shared by
 * leadership's position group and the admin's seat group — the two panes differ
 * in what an admin can do, never in how a suggestion reads.
 */
export function RequestSuggestionCard({ suggestion }) {
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
}

// One card for the whole gap, not one per seat: eighteen seats produced
// sixteen identical "no one put forward yet" tiles that pushed the actual
// suggestions off the top of the pane. The number is the information — which
// particular empty seat it is never was.
export function RequestEmptySeats({ count }) {
  return (
    <div className="symphony-seat-empty-card" data-test="empty-seats">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-border text-xs font-semibold">
        +{count}
      </span>
      <p className="text-xs">still to put forward</p>
    </div>
  );
}
