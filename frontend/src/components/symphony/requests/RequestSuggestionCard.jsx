import { Link } from 'react-router-dom';
import { formatSuggestionMeta } from '@/helpers/staffingRequests';
import { cn } from '@/lib/utils';
import { getSuggestionState } from './requestPresentation';
import { UserAvatar } from '@/components/ui/user-avatar';

// Where an intern stands, as a pill rather than the tail of the meta line. It is
// the one thing on the card that decides whether this person is actually coming,
// and at two columns it was the part that clipped.
const STATE_PILL = {
  placed: 'bg-[hsl(var(--symphony-placed)/0.15)] text-[hsl(var(--symphony-placed))]',
  active: 'bg-[hsl(var(--symphony-brand)/0.14)] text-[hsl(var(--symphony-brand-ink))]',
  muted: 'bg-muted text-muted-foreground',
};

export function SuggestionStatePill({ label, tone = 'active', className }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold capitalize',
        STATE_PILL[tone] ?? STATE_PILL.active,
        className
      )}
    >
      {label}
    </span>
  );
}

/**
 * One intern already put forward for a requested position. Shared by
 * leadership's position group and the admin's seat group — the two panes differ
 * in what an admin can do, never in how a suggestion reads.
 *
 * Solid border, and the state in a pill on the right. A staged pick (admin-side,
 * never sent) keeps the dashed border to itself: it is the only state on this
 * screen the admin can still take back, so it must not look like anything
 * leadership has already been told about.
 */
export function RequestSuggestionCard({ suggestion }) {
  const state = getSuggestionState(suggestion);
  const meta = formatSuggestionMeta(suggestion);

  return (
    <div className="symphony-suggestion" data-test={`suggestion-${suggestion.id}`}>
      <UserAvatar
        user={{ fullname: suggestion.internName, avatarUrl: suggestion.internAvatarUrl }}
        className="h-8 w-8 text-[11px]"
        showTitle={false}
      />
      <div className="min-w-0 flex-1">
        {suggestion.internProfile ? (
          <Link
            to={`/interns/${suggestion.internProfile}`}
            className="block truncate text-sm font-semibold text-foreground hover:underline"
          >
            {suggestion.internName}
          </Link>
        ) : (
          <p className="truncate text-sm font-semibold text-foreground">{suggestion.internName}</p>
        )}
        <p className="truncate text-xs leading-snug text-muted-foreground">{meta}</p>
      </div>
      <SuggestionStatePill label={state.label} tone={state.tone} />
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
