import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/staffingRequests';
import { usePutForwardCandidates, usePutInternsForward } from '@/queries/staffingRequests';
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
    return where ? `In selection for ${where}` : 'In selection elsewhere';
  }
  return null;
};

const CandidateRow = ({ candidate, checked, onToggle }) => {
  const warnings = (candidate.flags ?? []).map(describeFlag).filter(Boolean);

  return (
    <label
      className={cn(
        'flex w-full cursor-pointer items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors',
        'hover:bg-primary/[0.06] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        checked && 'bg-primary/[0.08]'
      )}
      data-test={`put-forward-candidate-${candidate.internProfile}`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(candidate.internProfile)}
        className="mt-1.5"
        aria-label={`Put ${candidate.internName} forward`}
      />
      <span
        className={cn(
          'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          getAvatarColor(candidate.internName)
        )}
        aria-hidden="true"
      >
        {getInitials(candidate.internName)}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">
          {candidate.internName}
        </span>
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">
          {[candidate.position, ...(candidate.technologies ?? []).slice(0, 4)]
            .filter(Boolean)
            .join(' · ') || candidate.email}
        </span>
        {warnings.map((warning) => (
          <span
            key={warning}
            className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          >
            {warning}
          </span>
        ))}
      </span>
    </label>
  );
};

/**
 * The admin's answer to one requested position: pick interns, and each pick
 * becomes an ordinary recommendation against the request's project, tagged back
 * to the request with the position forced to this one. It is scoped to a single
 * requested position rather than the whole request on purpose — an intern is
 * offered for the discipline that was actually asked for, never from one flat
 * list where the position would be a second guess.
 *
 * More interns than the count may be picked. Over-supply is expected: interviews
 * fail, and an admin sourcing three people for two seats is doing the job right.
 */
export function PutForwardModal({ open, onOpenChange, request, row }) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState([]);

  const requestId = request?.id;
  const positionId = row?.id;

  const { data, isPending, isError } = usePutForwardCandidates(
    { requestId, positionId },
    { enabled: open && Boolean(requestId && positionId) }
  );
  const mutation = usePutInternsForward();

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setPicked([]);
  }, [open, positionId]);

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = data?.candidates ?? [];
    if (!term) return all;
    return all.filter((candidate) =>
      [candidate.internName, candidate.position, ...(candidate.technologies ?? [])]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term))
    );
  }, [data, search]);

  const toggle = (internProfile) => {
    setPicked((current) =>
      current.includes(internProfile)
        ? current.filter((id) => id !== internProfile)
        : [...current, internProfile]
    );
  };

  const technologies = (row?.technologies ?? []).filter(Boolean);

  const onSubmit = async () => {
    try {
      await mutation.mutateAsync({ id: requestId, positionId, internProfileIds: picked });
      toast.success(
        picked.length === 1 ? '1 intern put forward' : `${picked.length} interns put forward`
      );
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not put anyone forward', {
        description: error?.response?.data?.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg" data-test="put-forward-modal">
        <DialogHeader className="gap-1 border-b border-border/60 px-6 py-5">
          <DialogTitle className="text-xl font-bold">Put interns forward — {row?.name}</DialogTitle>
          <DialogDescription>
            Each pick creates a recommendation on this project for this position. Putting someone
            forward is not placing them.
          </DialogDescription>
          {/* What a pick gets judged against — the request asked for these. */}
          {technologies.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-1">
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
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search interns by name, position or technology…"
              className="pl-9"
              autoFocus
              data-test="put-forward-search"
            />
          </div>

          <div className="max-h-80 space-y-1 overflow-y-auto">
            {isPending ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading interns…</p>
            ) : isError ? (
              <p className="py-6 text-center text-sm text-destructive">Could not load interns.</p>
            ) : candidates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {search.trim() ? 'No intern matches that search.' : 'No intern can be put forward.'}
              </p>
            ) : (
              candidates.map((candidate) => (
                <CandidateRow
                  key={candidate.internProfile}
                  candidate={candidate}
                  checked={picked.includes(candidate.internProfile)}
                  onToggle={toggle}
                />
              ))
            )}
          </div>
        </div>

        <DialogFooter className="items-center gap-3 border-t border-border/60 px-6 py-4 sm:justify-between">
          <p className="text-sm text-muted-foreground" data-test="put-forward-hint">
            {picked.length === 0
              ? `${row?.wanted ?? 0} ${row?.wanted === 1 ? 'seat' : 'seats'} asked for`
              : `${picked.length} picked for ${row?.wanted ?? 0} ${row?.wanted === 1 ? 'seat' : 'seats'}`}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={picked.length === 0 || mutation.isPending}
              data-test="put-forward-save"
            >
              <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              {mutation.isPending ? 'Putting forward…' : 'Put forward'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
