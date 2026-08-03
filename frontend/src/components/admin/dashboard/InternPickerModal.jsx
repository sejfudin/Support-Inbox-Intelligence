import { useMemo, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';
import { useInterns } from '@/queries/interns';
import {
  isRecommendBlockedByProfileStatus,
  recommendBlockedReason,
} from '@/helpers/recommendations';
import { cn } from '@/lib/utils';

// Short chip labels for the disabled rows. The rule itself and the full sentence
// come from helpers/recommendations.js — the same source the New recommendation
// button on the intern's own profile uses, so the two can never disagree about
// who is eligible.
const SHORT_REASONS = {
  placed: 'On a project',
  completed: 'Completed',
  discontinued: 'Left',
};

export function InternPickerModal({ open, onClose, onSelect, title, description, actionLabel }) {
  const [search, setSearch] = useState('');

  // The whole roster, filtered client-side: it is a few dozen rows, and typing
  // against a local list beats a request per keystroke.
  const { data, isPending, isError } = useInterns({ pagination: false }, { enabled: open });

  const rows = useMemo(() => {
    const interns = data?.interns || [];
    const term = search.trim().toLowerCase();

    return (
      interns
        .map((profile) => ({
          profileId: profile._id,
          userId: profile.user?._id,
          fullname: profile.user?.fullname || profile.user?.email || 'Unknown',
          email: profile.user?.email || '',
          position: profile.declaredPosition?.name || '',
          status: profile.status,
          blocked: isRecommendBlockedByProfileStatus(profile.status),
          shortReason: SHORT_REASONS[profile.status] || 'Unavailable',
          fullReason: recommendBlockedReason(profile.status),
        }))
        .filter((row) => row.userId)
        .filter(
          (row) =>
            !term ||
            row.fullname.toLowerCase().includes(term) ||
            row.email.toLowerCase().includes(term) ||
            row.position.toLowerCase().includes(term)
        )
        // Selectable people first, then alphabetical — the blocked rows are context,
        // not the point of the list.
        .sort((a, b) => {
          if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
          return a.fullname.localeCompare(b.fullname);
        })
    );
  }, [data, search]);

  const blockedCount = rows.filter((row) => row.blocked).length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or position…"
            data-test="intern-picker-search"
            className="pl-9"
          />
        </div>

        {blockedCount > 0 && (
          <p className="text-[11px] leading-4 text-muted-foreground">
            {blockedCount} greyed-out {blockedCount === 1 ? 'intern is' : 'interns are'} not
            available — they have left the programme or are already placed on a project.
          </p>
        )}

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {isPending && <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>}

          {isError && (
            <p className="py-6 text-center text-xs text-destructive">Could not load interns.</p>
          )}

          {!isPending && !isError && rows.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {search ? 'No intern matches that search.' : 'No interns yet.'}
            </p>
          )}

          {rows.map((row) => {
            const disabled = row.blocked;
            return (
              <button
                key={row.userId}
                type="button"
                disabled={disabled}
                data-test={`intern-picker-option-${row.userId}`}
                onClick={() => onSelect(row)}
                aria-label={
                  disabled
                    ? `${row.fullname} — ${row.fullReason}`
                    : `${actionLabel} ${row.fullname}`
                }
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
                  disabled
                    ? 'cursor-not-allowed opacity-45'
                    : 'hover:bg-primary/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    getAvatarColor(row.fullname)
                  )}
                  aria-hidden="true"
                >
                  {row.fullname === 'Unknown' ? (
                    <UserRound className="h-4 w-4" />
                  ) : (
                    getInitials(row.fullname)
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">
                    {row.fullname}
                  </span>
                  <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                    {row.position || row.email}
                  </span>
                </span>

                {disabled && (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {row.shortReason}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
