import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, TriangleAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { getAvatarColor } from '@/helpers/avatarColor';
import { formatSuggestionMeta, getInitials } from '@/helpers/staffingRequests';
import { usePutForwardCandidates } from '@/queries/staffingRequests';
import { cn } from '@/lib/utils';

// A flag is data from the server's picker rules — the sentence is written here.
// Both of these are warnings, never blocks: putting someone forward who is
// already committed elsewhere is legitimate when a process falls through or a
// stronger opportunity appears, and refusing it would only push an admin to
// edit recommendations by hand.
const describeFlag = (flag) => {
  const where = (flag.projects ?? []).join(', ');
  if (flag.type === 'placed') {
    return where ? `Already placed on ${where}` : 'Already placed';
  }
  if (flag.type === 'in-selection') {
    return where ? `Already open on ${where}` : 'Already open elsewhere';
  }
  return null;
};

/**
 * One intern the armed seat could be filled with. The conflict warning wraps
 * rather than truncating — it is the one string on this screen that must never
 * clip, because it is the whole reason the admin might not want this person —
 * and a conflicted row gets its own add control ("Add anyway") so the decision
 * is made at the button rather than discovered after it.
 */
const CandidateRow = ({ candidate, staged, onToggle }) => {
  const warnings = (candidate.flags ?? []).map(describeFlag).filter(Boolean);
  const meta = formatSuggestionMeta(candidate);

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 transition-colors',
        staged
          ? 'border-[hsl(var(--symphony-brand)/0.6)] bg-[hsl(var(--symphony-brand)/0.08)]'
          : warnings.length > 0
            ? 'border-amber-400/50 bg-amber-50/50 dark:bg-amber-500/[0.06]'
            : 'border-border bg-transparent'
      )}
      data-test={`candidate-${candidate.internProfile}`}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          getAvatarColor(candidate.internName)
        )}
        aria-hidden="true"
      >
        {getInitials(candidate.internName)}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold leading-tight text-foreground">
          {candidate.internName}
        </p>
        {/* Shown for every row, staged included: the candidate under active
            consideration is the one that most needs comparing. */}
        <p className="text-xs leading-snug text-muted-foreground">
          {meta || candidate.position || candidate.email}
        </p>
        {staged && (
          <p className="text-xs font-semibold leading-snug text-[hsl(var(--symphony-brand-ink))]">
            Staged — not sent yet
          </p>
        )}
        {warnings.map((warning) => (
          <p
            key={warning}
            className="flex items-start gap-1.5 text-xs font-medium leading-snug text-amber-700 dark:text-amber-300"
          >
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{warning}</span>
          </p>
        ))}
      </div>

      <Button
        type="button"
        size={warnings.length > 0 && !staged ? 'sm' : 'icon'}
        variant={staged ? 'default' : 'outline'}
        className={cn(
          'shrink-0',
          warnings.length > 0 && !staged ? 'h-8 px-2.5 text-xs' : 'h-8 w-8'
        )}
        onClick={() => onToggle(candidate)}
        aria-label={
          staged
            ? `Remove ${candidate.internName} from this seat`
            : `Stage ${candidate.internName} for this seat`
        }
        data-test={`candidate-toggle-${candidate.internProfile}`}
      >
        {staged ? (
          <Minus className="h-4 w-4" aria-hidden="true" />
        ) : warnings.length > 0 ? (
          'Add anyway'
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </li>
  );
};

/**
 * The candidate rail: who could fill the seat the admin has armed. Nothing here
 * writes — every add stages a pick into the page's cart, and only
 * `Submit to leadership` ever reaches the server.
 *
 * It is filtered to one requested position at a time on purpose (as the picker
 * has been since ticket 07): an intern is offered for the discipline that was
 * actually asked for, never out of one flat list where the position would be a
 * second guess. Which seat that is, is stated at the top and clearable there.
 */
export function AdminCandidateRail({
  request,
  row,
  stagedIdsForSeat,
  stagedIdsElsewhere,
  onToggle,
  onClearSeat,
}) {
  const [search, setSearch] = useState('');

  const requestId = request?.id;
  const positionId = row?.id;

  const { data, isPending, isError } = usePutForwardCandidates(
    { requestId, positionId },
    { enabled: Boolean(requestId && positionId) }
  );

  useEffect(() => {
    setSearch('');
  }, [positionId, requestId]);

  const candidates = useMemo(() => {
    // Staged onto another seat of this same request counts as taken: one person
    // cannot answer two of one request's seats, and the server refuses it on
    // submit. Feeding the cart into the same exclusion the server applies to
    // interns genuinely put forward keeps the two consistent.
    const all = (data?.candidates ?? []).filter(
      (candidate) => !stagedIdsElsewhere.has(candidate.internProfile)
    );
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((candidate) =>
      [candidate.internName, candidate.position, ...(candidate.technologies ?? [])]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term))
    );
  }, [data, search, stagedIdsElsewhere]);

  if (!row) {
    return (
      <SymphonyCard className="space-y-2 text-center" data-test="candidate-rail-idle">
        <Users className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">Candidates</p>
        <p className="text-sm text-muted-foreground">
          Pick a seat on the request to see who could fill it.
        </p>
      </SymphonyCard>
    );
  }

  return (
    <SymphonyCard className="space-y-3" data-test="candidate-rail">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Candidates</h2>
          <p
            className="truncate text-sm font-semibold text-[hsl(var(--symphony-brand-ink))]"
            data-test="candidate-rail-seat"
          >
            Filling {row.name}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2.5 text-xs"
          onClick={onClearSeat}
          data-test="candidate-rail-clear"
        >
          Clear seat
        </Button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or skill…"
          className="pl-9"
          aria-label="Search candidates"
          data-test="candidate-rail-search"
        />
      </div>

      {!isPending && !isError && (
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {candidates.length} {candidates.length === 1 ? 'match' : 'matches'}
        </p>
      )}

      {isPending ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading interns…</p>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-destructive">Could not load interns.</p>
      ) : candidates.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {search.trim() ? 'No intern matches that search.' : 'No intern can be put forward.'}
        </p>
      ) : (
        <ul className="max-h-[calc(100vh-28rem)] space-y-2 overflow-y-auto pr-1">
          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.internProfile}
              candidate={candidate}
              staged={stagedIdsForSeat.has(candidate.internProfile)}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </SymphonyCard>
  );
}
