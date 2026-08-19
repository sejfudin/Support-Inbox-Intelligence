import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FilterChip } from '@/components/ui/filter-chip';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import { CHIP } from '@/helpers/badgeTones';
import { dayStatusLabel, formatRequestDayRuns } from '@/helpers/attendance';
import { dayStatusClass } from '@/components/attendance/dayStatusVisuals';
import {
  useAbsenceRequests,
  useDecideAbsenceRequest,
  useRevokeAbsenceRequest,
} from '@/queries/absenceRequests';

const STATUS_BADGE = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'info', label: 'Approved' },
  rejected: { variant: 'destructive', label: 'Rejected' },
  cancelled: { variant: 'outline', label: 'Withdrawn' },
  revoked: { variant: 'destructive', label: 'Revoked' },
};

// `null` is the "everything" tab. Kept alongside the four types so the filter row
// is one list rather than a special case plus a map.
const TYPE_FILTERS = [null, 'remote', 'vacation', 'religious', 'sick'];

/**
 * The admin list of absence requests — remote work, vacation, religious
 * holidays and sick days, in one place. Two modes over one component:
 *
 * - `queue` (default): only what is waiting on a decision, with the note field and
 *   the two verdict buttons on every row.
 * - `history`: only what has already been settled — approved, rejected, withdrawn
 *   or revoked — read-only apart from revoking an approval that was a mistake.
 *
 * They are the same row with the same rules and would drift apart as two files;
 * the mode only decides what is fetched, what the row can do, and what the empty
 * state says.
 *
 * A request is **decided as a unit** — approving writes an attendance row for every
 * day in it, rejecting refuses all of them. There is no per-day verdict: the intern
 * chose those days together, and half-approving would grant a request they never
 * made. If only some days suit, reject with a note and let them re-ask for the ones
 * that work.
 *
 * The queue is ordered by the earliest day asked for, not by submission time: the
 * request for tomorrow is the one about to go stale. A sick day sorts to the top of
 * that ordering by nature, since it is always for today or the last couple of days.
 *
 * ── The row ──────────────────────────────────────────────────────────────────
 *
 * One row is one decision, laid out so the whole queue can be cleared without a
 * click that isn't a verdict: who and what on the left, the note field and the two
 * buttons on the right, nothing in between. The second line carries the days asked
 * for **and** how long the request has waited, which is the pair that decides order
 * of attention — a request for tomorrow raised a week ago and one raised this
 * morning read very differently.
 *
 * Carries no heading of its own: it fills a tab of the absence-requests page, which
 * already names it and carries the pending count.
 */
export default function AbsenceRequestQueue({ mode = 'queue' }) {
  const isHistory = mode === 'history';
  const [typeFilter, setTypeFilter] = useState(null);
  const [notes, setNotes] = useState({});

  // History asks for everything and drops what is still pending, because the API
  // filters on one status at a time and "decided" is four of them.
  const { data, isPending, isError } = useAbsenceRequests({
    status: isHistory ? 'all' : 'pending',
    ...(typeFilter ? { type: typeFilter } : {}),
  });
  const { mutate: decide, isPending: isDeciding } = useDecideAbsenceRequest();
  const { mutate: revoke, isPending: isRevoking } = useRevokeAbsenceRequest();

  const allRequests = data?.requests ?? [];
  const requests = isHistory
    ? allRequests.filter((request) => request.status !== 'pending')
    : allRequests;
  const pendingCount = data?.pendingCount ?? 0;
  const pendingByType = data?.pendingByType ?? {};
  const busy = isDeciding || isRevoking;

  const noteFor = (id) => notes[id] || '';
  const setNote = (id, value) => setNotes((prev) => ({ ...prev, [id]: value }));

  return (
    <div
      className="app-card overflow-hidden"
      data-test={isHistory ? 'absence-request-history' : 'absence-request-queue'}
    >
      {/* The filter band. Sits inside the card and above the list rather than out
          on the page, because it narrows this list and nothing else. */}
      <div
        className="flex flex-wrap gap-[var(--control-gap)] border-b border-separator bg-muted/30 px-4 py-3 md:px-5"
        aria-label="Filter by request type"
      >
        {TYPE_FILTERS.map((value) => {
          const selected = typeFilter === value;
          // Counted across every type and unaffected by the filter: the "All"
          // count and the nav dot both mean "anything waiting", and a number that
          // emptied when you filtered would read as an inbox reaching zero. The
          // history carries no counts — nothing there is waiting for anything.
          const waiting = isHistory ? 0 : value ? pendingByType[value] || 0 : pendingCount;
          return (
            <FilterChip
              key={value ?? 'all'}
              label={value ? dayStatusLabel(value) : 'All'}
              count={waiting > 0 ? waiting : undefined}
              pressed={selected}
              onClick={() => setTypeFilter(value)}
              data-test={`absence-request-filter-${value ?? 'all'}`}
            />
          );
        })}
      </div>

      {isError && (
        <p className="px-4 py-6 text-sm text-[hsl(var(--tone-danger-fg))] md:px-5">
          Failed to load requests.
        </p>
      )}
      {isPending && <p className="px-4 py-6 text-sm text-muted-foreground md:px-5">Loading…</p>}

      {!isPending && !isError && requests.length === 0 && (
        <p
          className="px-4 py-8 text-center text-sm text-muted-foreground md:px-5"
          data-test="absence-request-queue-empty"
        >
          {isHistory ? 'Nothing decided yet.' : 'Nothing waiting on a decision.'}
        </p>
      )}

      {!isPending && !isError && requests.length > 0 && (
        <ul className="divide-y divide-separator" data-test="absence-request-queue-list">
          {requests.map((request) => {
            const badge = STATUS_BADGE[request.status] || {
              variant: 'secondary',
              label: request.status,
            };
            const isDecidable = request.status === 'pending';
            const name = request.intern.fullname || request.intern.email || '?';

            return (
              <li
                key={request.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 transition-colors hover:bg-muted/30 md:flex-nowrap md:px-5"
                data-test={`absence-request-queue-row-${request.id}`}
              >
                <InitialsAvatar name={name} size="md" aria-hidden="true" />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-foreground">{name}</span>
                    {/* The type reads as a tinted pill in the status's own colour —
                        the same hue the calendar draws that day in, so the queue
                        and the month agree about what a sick day looks like. */}
                    <span className={cn(CHIP, dayStatusClass(request.type))}>
                      {dayStatusLabel(request.type)}
                    </span>
                    {/* Pending is the queue's whole premise, so its badge would be
                        noise there — everything in the history has to say so. */}
                    {!isDecidable && <Badge variant={badge.variant}>{badge.label}</Badge>}
                    {request.intern.hub && (
                      <span className="text-xs text-muted-foreground">{request.intern.hub}</span>
                    )}
                  </div>

                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    {/* Every day, not just the first — the admin is deciding all of
                        them at once and has to see what they are agreeing to. */}
                    <span>
                      {request.dates?.length
                        ? formatRequestDayRuns(request.dates)
                        : 'No days on this request'}
                    </span>
                    {request.dates?.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {request.dates.length} {request.dates.length === 1 ? 'day' : 'days'}
                        </span>
                      </>
                    )}
                    {/* How long it waited, or who ended the wait. The queue needs
                        the age; the history needs the verdict's author, which is
                        the one question a settled request still raises. */}
                    {isHistory && request.decidedAt ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          decided {format(new Date(request.decidedAt), 'd MMM yyyy')}
                          {request.decidedBy ? ` by ${request.decidedBy}` : ''}
                        </span>
                      </>
                    ) : (
                      request.createdAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            requested{' '}
                            {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                          </span>
                        </>
                      )
                    )}
                    {/* Who this was addressed to — every admin still sees and can
                        decide it (the queue stays shared), but only the named admin
                        was notified, so the row has to say who that was. */}
                    {request.recipientAdmin && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>for {request.recipientAdmin.fullname}</span>
                      </>
                    )}
                  </p>

                  {request.reason && (
                    <p className="text-xs italic text-muted-foreground">“{request.reason}”</p>
                  )}
                  {request.decisionNote && (
                    <p className="text-xs text-muted-foreground">
                      Decision note: “{request.decisionNote}”
                    </p>
                  )}
                </div>

                {/* The row-actions rule, in full: everything here is `sm`, so the
                    note field and both buttons sit on one 28px baseline. One
                    primary per row — Approve — and Reject stays quiet until the
                    pointer is on it rather than shouting red down the whole
                    queue. */}
                {isDecidable && (
                  <div className="flex w-full shrink-0 flex-wrap items-center gap-[var(--control-gap)] md:w-auto md:flex-nowrap">
                    <Input
                      size="sm"
                      value={noteFor(request.id)}
                      onChange={(e) => setNote(request.id, e.target.value)}
                      placeholder="Note (optional, shown to the intern)"
                      className="w-full md:w-[260px]"
                      maxLength={500}
                      aria-label={`Decision note for ${name}`}
                      data-test={`absence-request-note-${request.id}`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        decide({
                          id: request.id,
                          decision: 'approved',
                          note: noteFor(request.id),
                        })
                      }
                      data-test={`absence-request-approve-${request.id}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost-destructive"
                      disabled={busy}
                      onClick={() =>
                        decide({
                          id: request.id,
                          decision: 'rejected',
                          note: noteFor(request.id),
                        })
                      }
                      data-test={`absence-request-reject-${request.id}`}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                )}

                {/* An approval can be taken back after the fact — it wrote days into
                    the intern's month, and the only way to unwrite them is here. */}
                {request.status === 'approved' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost-destructive"
                    className="shrink-0"
                    disabled={busy}
                    onClick={() => revoke({ id: request.id, note: noteFor(request.id) })}
                    title="Removes every day of this request from the intern's attendance"
                    data-test={`absence-request-revoke-${request.id}`}
                  >
                    <Undo2 className="h-3 w-3" />
                    Revoke approval
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator bg-muted/20 px-4 py-3 md:px-5">
        <p className="text-xs text-muted-foreground">
          {isHistory
            ? 'Every request already settled — approved, rejected, withdrawn or revoked.'
            : 'Decided requests move to the History tab.'}
        </p>
        {requests.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {requests.length} {requests.length === 1 ? 'request' : 'requests'}
          </span>
        )}
      </div>
    </div>
  );
}
