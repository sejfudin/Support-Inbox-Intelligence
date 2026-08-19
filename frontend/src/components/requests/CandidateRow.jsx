import { Link } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatSuggestionMeta } from '@/helpers/staffingRequests';
import { getSuggestionState } from '@/components/symphony/requests/requestPresentation';
import { UserAvatar } from '@/components/ui/user-avatar';

// Where an intern stands, as a pill rather than the tail of the meta line. It is
// the one thing on the row that decides whether this person is actually coming,
// and at two columns it was the part that clipped.
const STATE_PILL = {
  placed:
    'bg-[hsl(var(--tone-success)/0.15)] text-[hsl(var(--tone-success-fg))] dark:bg-[hsl(var(--tone-success)/0.2)]',
  active: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
};

export function CandidateStatePill({ label, tone = 'active', className }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[var(--r-control)] px-2 py-0.5 text-[11px] font-semibold capitalize',
        STATE_PILL[tone] ?? STATE_PILL.active,
        className
      )}
    >
      {label}
    </span>
  );
}

const Shell = ({ className, children, ...rest }) => (
  <div
    className={cn(
      'flex items-center gap-3 rounded-[var(--r-control)] border border-border bg-card px-3 py-2.5',
      className
    )}
    {...rest}
  >
    {children}
  </div>
);

/** One intern already put forward for a requested position. Read-only. */
export function CandidateRow({ suggestion }) {
  const state = getSuggestionState(suggestion);

  return (
    <Shell data-test={`suggestion-${suggestion.id}`}>
      <UserAvatar
        user={{ fullname: suggestion.internName, avatarUrl: suggestion.internAvatarUrl }}
      />
      <div className="min-w-0 flex-1">
        {suggestion.internProfile ? (
          <Link
            to={`/interns/${suggestion.internProfile}`}
            className="block truncate text-[13px] font-semibold text-foreground hover:underline"
          >
            {suggestion.internName}
          </Link>
        ) : (
          <p className="truncate text-[13px] font-semibold text-foreground">
            {suggestion.internName}
          </p>
        )}
        <p className="truncate text-[11.5px] leading-snug text-muted-foreground">
          {formatSuggestionMeta(suggestion)}
        </p>
      </div>
      <CandidateStatePill label={state.label} tone={state.tone} />
    </Shell>
  );
}

/**
 * A pick that has been staged but never sent. Same skills-and-duration line as
 * everyone else — the candidate under active consideration is the one most in
 * need of comparing — and it keeps the dashed border to itself: of everyone on
 * this card it is the only one the admin can still take back.
 */
export function StagedCandidateRow({ pick, rejection, onRemove }) {
  return (
    <Shell
      className={cn(
        'border-dashed border-primary/50 bg-primary/[0.04]',
        rejection && 'border-solid border-destructive/60'
      )}
      data-test={`staged-pick-${pick.id}`}
    >
      <UserAvatar user={{ fullname: pick.name, avatarUrl: pick.avatarUrl }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{pick.name}</p>
        <p className="truncate text-[11.5px] leading-snug text-muted-foreground">
          {formatSuggestionMeta(pick)}
        </p>
        {/* A stale pick reports against its own row: the admin drops this one and
            submits the rest, rather than being told the whole cart was wrong. */}
        {rejection && (
          <p
            className="mt-1 flex items-start gap-1.5 text-[11.5px] font-medium leading-snug text-[hsl(var(--tone-danger-fg))]"
            data-test={`staged-pick-rejection-${pick.id}`}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {rejection}
          </p>
        )}
      </div>
      <CandidateStatePill label="Staged" />
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
    </Shell>
  );
}

/**
 * One card for the whole gap, not one per seat: eighteen seats produced sixteen
 * identical "no one put forward yet" tiles that pushed the actual suggestions
 * off the top of the pane. The number is the information — which particular
 * empty seat it is never was.
 */
export function EmptySeatsRow({ count }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[var(--r-control)] border border-dashed border-border px-3 py-2.5 text-muted-foreground"
      data-test="empty-seats"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-border text-xs font-semibold">
        +{count}
      </span>
      <p className="text-[11.5px]">still to put forward</p>
    </div>
  );
}
