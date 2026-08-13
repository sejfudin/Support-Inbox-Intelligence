import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { getAvatarColor } from '@/helpers/avatarColor';
import { formatSuggestionMeta, getInitials } from '@/helpers/staffingRequests';
import { TechnologyIcon, buildTechnologyIndex } from '@/helpers/technologyIcons';
import { usePutForwardCandidates } from '@/queries/staffingRequests';
import { useTechnologies } from '@/queries/technologies';
import { cn } from '@/lib/utils';
import { getRequestTitle } from './requestPresentation';

// How many technology chips stay on screen before the rest fold behind
// "+N more". Chips the admin has switched on are always counted in, so a filter
// can never end up hidden behind the fold while it is still narrowing the list.
const VISIBLE_TECHNOLOGY_CHIPS = 6;

// A flag is data from the server's picker rules — the sentence is written here.
// Both of these are warnings, never blocks: putting someone forward who is
// already committed elsewhere is legitimate when a process falls through or a
// stronger opportunity appears, and refusing it would only push an admin to
// edit recommendations by hand.
//
// One project is named — it is short and it is the context an admin would
// otherwise have to go look up. Two or more collapse to a count instead of a
// comma-joined list, since a list of project names past the first stops being
// something you read and starts being something you count anyway.
const describeFlag = (flag) => {
  const projects = flag.projects ?? [];
  const verb =
    flag.type === 'placed' ? 'Placed on' : flag.type === 'in-selection' ? 'Put forward on' : null;
  if (!verb) return null;
  if (projects.length === 0) {
    return { prefix: flag.type === 'placed' ? 'Already placed' : 'Put forward elsewhere' };
  }
  if (projects.length === 1) {
    return { prefix: `${verb} ${projects[0]}` };
  }
  return { prefix: `${verb} `, count: projects.length, suffix: ' other projects' };
};

const describeCandidate = (candidate) => (candidate.flags ?? []).map(describeFlag).filter(Boolean);

// Rendered warning pieces, count bolded so the number an admin actually
// weighs a conflict on doesn't read as flat as the project names beside it.
const CandidateWarnings = ({ warnings }) => (
  <>
    {warnings.map((warning, index) => (
      <span key={index}>
        {index > 0 && ' · '}
        {warning.prefix}
        {warning.count != null && <strong className="font-bold">{warning.count}</strong>}
        {warning.suffix}
      </span>
    ))}
  </>
);

const toPick = (candidate) => ({
  id: candidate.internProfile,
  name: candidate.internName,
  technologies: candidate.technologies ?? [],
  startDate: candidate.startDate ?? null,
});

/**
 * One intern this position could be filled with. The row carries exactly one
 * decision — the button says what pressing it does (`Add`, `Remove`, or
 * `Add anyway` for someone already committed elsewhere), so the conflict is
 * weighed before the click rather than discovered after it.
 *
 * A conflict reads as the tail of the meta line rather than as its own warning
 * block: it is one more fact about the person, alongside their skills, and
 * stacking it vertically was what made the old list hard to scan.
 */
const CandidateRow = ({ candidate, staged, onToggle }) => {
  const warnings = describeCandidate(candidate);
  const meta = formatSuggestionMeta(candidate);
  const conflicted = warnings.length > 0;

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
        staged
          ? 'border-[hsl(var(--symphony-brand)/0.6)] bg-[hsl(var(--symphony-brand)/0.07)]'
          : 'border-border hover:bg-muted/40'
      )}
      data-test={`candidate-${candidate.internProfile}`}
    >
      <span
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          getAvatarColor(candidate.internName)
        )}
        aria-hidden="true"
      >
        {getInitials(candidate.internName)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold leading-tight text-foreground">
          <span className="truncate">{candidate.internName}</span>
          {staged && (
            <span className="shrink-0 rounded-md bg-[hsl(var(--symphony-brand)/0.15)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[hsl(var(--symphony-brand-ink))]">
              Staged
            </span>
          )}
        </p>
        <p className="truncate text-xs leading-snug text-muted-foreground">
          {meta || candidate.position || candidate.email}
          {warnings.length > 0 && (
            <>
              {(meta || candidate.position || candidate.email) && ' · '}
              <span className="font-medium text-amber-700 dark:text-amber-300">
                <CandidateWarnings warnings={warnings} />
              </span>
            </>
          )}
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        variant={staged ? 'outline' : conflicted ? 'outline' : 'default'}
        className="h-8 shrink-0 px-3 text-xs font-semibold"
        onClick={() => onToggle(candidate)}
        data-test={`candidate-toggle-${candidate.internProfile}`}
      >
        {staged ? 'Remove' : conflicted ? 'Add anyway' : 'Add'}
      </Button>
    </li>
  );
};

/**
 * The picker for one requested position: who could fill its seats. Nothing here
 * writes to the server — `Save` hands the picks to the page's cart, and only
 * `Submit to leadership` on the request pane ever reaches the API. Picking and
 * sending stay two decisions.
 *
 * Picks are held as a draft inside the dialog rather than written to the cart
 * per click, so `Cancel` means something: an admin can try a shortlist on,
 * compare, and walk away without having changed what is queued to send. The
 * draft is seeded from whatever is already staged for this position, which is
 * also why re-opening the dialog shows the shortlist as it was left.
 */
export function PutForwardDialog({ open, onOpenChange, request, row, cart, onSave }) {
  const [search, setSearch] = useState('');
  const [technologyFilters, setTechnologyFilters] = useState([]);
  const [showAllTechnologies, setShowAllTechnologies] = useState(false);
  // The shortlist being assembled — `{ [internProfileId]: pick }`, so a row can
  // answer "am I in?" without scanning an array on every render.
  const [draft, setDraft] = useState({});

  const requestId = request?.id;
  const positionId = row?.id;

  const { data, isPending, isError } = usePutForwardCandidates(
    { requestId, positionId },
    { enabled: open && Boolean(requestId && positionId) }
  );

  // Only for the chip logos — a candidate's skills reach here as names, and the
  // icon map keys off slugs. Shared, long-cached query; no request of its own in
  // practice.
  const { data: allTechnologies = [] } = useTechnologies();
  const technologyIndex = useMemo(() => buildTechnologyIndex(allTechnologies), [allTechnologies]);

  // Filters describe one position's search, not the admin's session: opening
  // against another position starts clean rather than silently hiding people
  // under a chip left on from the last one. The draft is reseeded from the cart
  // in the same pass — the dialog opens showing what is already staged.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setTechnologyFilters([]);
    setShowAllTechnologies(false);
    setDraft(Object.fromEntries((cart[positionId] ?? []).map((pick) => [pick.id, pick])));
    // `cart` is read but deliberately not a dependency: it seeds the draft on
    // open, and re-running on every cart write would discard an edit in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, positionId, requestId]);

  // Staged onto another position of this same request counts as taken: one
  // person cannot answer two of one request's seats, and the server refuses it
  // on submit. Feeding the cart into the same exclusion the server applies to
  // interns genuinely put forward keeps the two consistent.
  const stagedElsewhere = useMemo(() => {
    const ids = new Set();
    for (const [key, picks] of Object.entries(cart)) {
      if (key === positionId) continue;
      picks.forEach((pick) => ids.add(pick.id));
    }
    return ids;
  }, [cart, positionId]);

  const askedTechnologies = useMemo(() => new Set(row?.technologies ?? []), [row]);

  /**
   * Chips, in two tiers. First what the request actually asked for — those lead
   * and stay marked as asked-for even when switched off, because they are the
   * brief and the admin should see them without hunting.
   *
   * The widening tier is drawn only from interns whose declared position is the
   * one being staffed. There is no position→technology map in reference data
   * (`Position` carries a name and nothing else), so an intern's own position is
   * the only signal for whether a skill belongs to this discipline: without it a
   * Data Engineer request offers a `Manual QA` chip that can only ever narrow
   * the list to people nobody asked for. Where no candidate declares this
   * position — a real gap while profiles are still being filled in — every
   * candidate's technologies are used instead, since one relevant chip beats an
   * empty filter row.
   */
  const technologyOptions = useMemo(() => {
    const candidates = data?.candidates ?? [];
    const sameDiscipline = candidates.filter((candidate) => candidate.position === row?.name);
    const widenFrom = sameDiscipline.length > 0 ? sameDiscipline : candidates;

    const rest = new Set();
    for (const candidate of widenFrom) {
      (candidate.technologies ?? []).forEach((name) => {
        if (!askedTechnologies.has(name)) rest.add(name);
      });
    }
    return [...askedTechnologies, ...[...rest].sort()];
  }, [row, data, askedTechnologies]);

  // The fold never swallows a chip the admin needs: everything the request asked
  // for is kept, and so is anything currently switched on — a filter hidden
  // behind "+N more" while it is still narrowing the list is how an admin ends
  // up staring at an empty list with no visible reason for it.
  const visibleTechnologies = useMemo(() => {
    if (showAllTechnologies) return technologyOptions;
    const kept = technologyOptions.filter(
      (name) => askedTechnologies.has(name) || technologyFilters.includes(name)
    );
    const rest = technologyOptions.filter((name) => !kept.includes(name));
    return [...kept, ...rest.slice(0, Math.max(0, VISIBLE_TECHNOLOGY_CHIPS - kept.length))];
  }, [technologyOptions, technologyFilters, askedTechnologies, showAllTechnologies]);

  const hiddenTechnologyCount = technologyOptions.length - visibleTechnologies.length;

  // Unassigned interns are the point of this dialog — someone free to take the
  // seat outright — so they lead the list. Anyone with a conflict still shows,
  // right below, rather than behind a fold: it is a warning the admin can act
  // past, not a reason to hide the person.
  const candidates = useMemo(() => {
    let all = (data?.candidates ?? []).filter(
      (candidate) =>
        !stagedElsewhere.has(candidate.internProfile) &&
        // Already placed on a project is a different thing than already put
        // forward: put-forward is still open-ended, but a placed intern has a
        // seat, and this dialog is for finding one, not for pulling someone off
        // one. They stay pickable everywhere else in the app — just not surfaced
        // as a suggestion here.
        !(candidate.flags ?? []).some((flag) => flag.type === 'placed')
    );

    const term = search.trim().toLowerCase();
    if (term) {
      all = all.filter((candidate) =>
        [candidate.internName, candidate.position, ...(candidate.technologies ?? [])]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(term))
      );
    }
    if (technologyFilters.length > 0) {
      all = all.filter((candidate) =>
        technologyFilters.every((name) => (candidate.technologies ?? []).includes(name))
      );
    }

    const unassigned = all.filter((candidate) => describeCandidate(candidate).length === 0);
    const conflicted = all.filter((candidate) => describeCandidate(candidate).length > 0);
    return [...unassigned, ...conflicted];
  }, [data, search, technologyFilters, stagedElsewhere]);

  const toggleTechnology = (name) =>
    setTechnologyFilters((current) =>
      current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name]
    );

  const toggleCandidate = (candidate) =>
    setDraft((current) => {
      if (current[candidate.internProfile]) {
        const next = { ...current };
        delete next[candidate.internProfile];
        return next;
      }
      return { ...current, [candidate.internProfile]: toPick(candidate) };
    });

  const unstage = (id) =>
    setDraft((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

  const draftPicks = Object.values(draft);
  const stagedIds = useMemo(() => new Set(Object.keys(draft)), [draft]);

  // A save that changes nothing should not be offered — and, since the draft is
  // seeded from the cart, "nothing" is the common case right after opening.
  const isDirty = useMemo(() => {
    const before = (cart[positionId] ?? []).map((pick) => pick.id);
    return before.length !== draftPicks.length || before.some((id) => !stagedIds.has(id));
  }, [cart, positionId, draftPicks.length, stagedIds]);

  const hasFilters = search.trim().length > 0 || technologyFilters.length > 0;

  if (!request || !row) return null;

  const seatsFilled = Math.min(row.placed ?? 0, row.wanted ?? 0);
  const seatProgress = row.wanted > 0 ? (seatsFilled / row.wanted) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl"
        data-test="put-forward-dialog"
      >
        <DialogHeader className="gap-0 space-y-0 border-b border-border/60 px-6 pb-5 pt-6 text-left">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {/* The position being staffed, said once and said loudly: the
                    dialog decides one position and every list below is scoped to
                    it. */}
                <span
                  className="rounded-lg bg-[hsl(var(--symphony-brand)/0.12)] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[hsl(var(--symphony-brand-ink))]"
                  data-test="picker-position-badge"
                >
                  {row.name}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {getRequestTitle(request)}
                </span>
              </div>
              <DialogTitle className="mt-2 text-2xl font-bold">Put interns forward</DialogTitle>
              <DialogDescription className="mt-1 max-w-lg">
                Picks are staged here and sent together from the request. Putting someone forward is
                not placing them.
              </DialogDescription>
            </div>

            {/* This position's own seats, not the request's — the dialog only
                ever decides one position, and a request-wide number here would
                be read as this one's. */}
            <div className="hidden w-44 shrink-0 pt-1 text-right sm:block">
              <p className="text-sm text-muted-foreground" data-test="picker-seats">
                <span className="font-bold text-foreground">{seatsFilled}</span> of {row.wanted}{' '}
                {row.wanted === 1 ? 'seat' : 'seats'} placed
              </p>
              <Progress
                value={seatProgress}
                className="mt-2 h-1.5 bg-muted"
                aria-label={`${seatsFilled} of ${row.wanted} seats placed`}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 border-b border-border/60 bg-muted/30 px-6 py-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or skill…"
              className="bg-background pl-9 pr-16"
              aria-label="Search candidates"
              autoFocus
              data-test="picker-search"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                data-test="picker-search-clear"
              >
                Clear
              </button>
            )}
          </div>

          {technologyOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {askedTechnologies.size > 0 && (
                <span className="mr-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Asked for
                </span>
              )}
              {visibleTechnologies.map((name, index) => {
                const active = technologyFilters.includes(name);
                const asked = askedTechnologies.has(name);
                // The one place the two tiers are told apart in layout: after
                // the last asked-for chip, before the widening ones.
                const startsRest =
                  !asked && index > 0 && askedTechnologies.has(visibleTechnologies[index - 1]);
                return (
                  <div key={name} className="flex items-center gap-2">
                    {startsRest && (
                      <span
                        className="h-4 w-px bg-border"
                        aria-hidden="true"
                        data-test="picker-technology-divider"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => toggleTechnology(name)}
                      aria-pressed={active}
                      title={asked ? 'Asked for on this request' : undefined}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                        active
                          ? 'border-[hsl(var(--symphony-brand)/0.65)] bg-[hsl(var(--symphony-brand)/0.12)] font-semibold text-[hsl(var(--symphony-brand-ink))]'
                          : asked
                            ? 'border-[hsl(var(--symphony-brand)/0.45)] bg-background font-semibold text-[hsl(var(--symphony-brand-ink))] hover:bg-[hsl(var(--symphony-brand)/0.08)]'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      )}
                      data-test={`picker-technology-${name}`}
                    >
                      <TechnologyIcon
                        technology={technologyIndex.get(name.toLowerCase())}
                        size={13}
                        className="shrink-0"
                      />
                      {name}
                      {active && <X className="h-3 w-3" aria-hidden="true" />}
                    </button>
                  </div>
                );
              })}
              {hiddenTechnologyCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllTechnologies(true)}
                  className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                  data-test="picker-technology-more"
                >
                  +{hiddenTechnologyCount} more
                </button>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading interns…</p>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-destructive">Could not load interns.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3 pb-2">
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground"
                  data-test="picker-available-count"
                >
                  {candidates.length} {candidates.length === 1 ? 'intern' : 'interns'}
                </p>
                {/* Says what the server actually does (`staffingRequestService`
                    sorts clean candidates by name) — a "best match" label with
                    no scoring behind it would be a promise the list breaks. */}
                <p className="text-xs text-muted-foreground">Unassigned first, then by name</p>
              </div>

              {candidates.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {hasFilters ? 'No intern matches those filters.' : 'No interns to put forward.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {candidates.map((candidate) => (
                    <CandidateRow
                      key={candidate.internProfile}
                      candidate={candidate}
                      staged={stagedIds.has(candidate.internProfile)}
                      onToggle={toggleCandidate}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-3 border-t border-border/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground"
              data-test="picker-total"
            >
              {draftPicks.length === 0 ? 'Nothing staged' : `Staged · ${draftPicks.length}`}
            </p>
            {draftPicks.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {draftPicks.map((pick) => (
                  <li
                    key={pick.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pl-1 pr-2 text-xs"
                  >
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                        getAvatarColor(pick.name)
                      )}
                      aria-hidden="true"
                    >
                      {getInitials(pick.name)}
                    </span>
                    <span className="max-w-[10rem] truncate font-medium">{pick.name}</span>
                    <button
                      type="button"
                      onClick={() => unstage(pick.id)}
                      aria-label={`Remove ${pick.name} from this position`}
                      className="text-muted-foreground hover:text-foreground"
                      data-test={`picker-unstage-${pick.id}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-test="picker-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!isDirty}
              onClick={() => {
                onSave(positionId, draftPicks);
                onOpenChange(false);
              }}
              data-test="picker-save"
            >
              {draftPicks.length === 0
                ? 'Save changes'
                : `Save ${draftPicks.length} ${draftPicks.length === 1 ? 'pick' : 'picks'}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
