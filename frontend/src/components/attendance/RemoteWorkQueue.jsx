import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, House, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  useRemoteWorkRequests,
  useDecideRemoteWorkRequest,
  useRevokeRemoteWorkRequest,
} from '@/queries/remoteWork';

const STATUS_BADGE = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'info', label: 'Approved' },
  rejected: { variant: 'destructive', label: 'Rejected' },
  cancelled: { variant: 'outline', label: 'Withdrawn' },
  revoked: { variant: 'destructive', label: 'Revoked' },
};

const formatDay = (key) => format(parseISO(key), 'EEE, d MMM');

/**
 * The admin queue for remote-work requests.
 *
 * A request covers 1–3 days and is **decided as a unit** — approving writes an
 * attendance row for every day in it, rejecting refuses all of them. There is no
 * per-day verdict: the intern chose those days together, and half-approving would
 * grant a request they never made. If only some days suit, reject with a note and
 * let them re-ask for the ones that work.
 *
 * Ordered by the earliest day asked for, not by submission time: the request for
 * tomorrow is the one about to go stale.
 */
export default function RemoteWorkQueue() {
  const [showAll, setShowAll] = useState(false);
  const [notes, setNotes] = useState({});

  const { data, isPending, isError } = useRemoteWorkRequests(
    showAll ? { status: 'all' } : { status: 'pending' }
  );
  const { mutate: decide, isPending: isDeciding } = useDecideRemoteWorkRequest();
  const { mutate: revoke, isPending: isRevoking } = useRevokeRemoteWorkRequest();

  const requests = data?.requests ?? [];
  const pendingCount = data?.pendingCount ?? 0;
  const busy = isDeciding || isRevoking;

  const noteFor = (id) => notes[id] || '';
  const setNote = (id, value) => setNotes((prev) => ({ ...prev, [id]: value }));

  return (
    <div className="app-panel p-4 md:p-5" data-test="remote-work-queue">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <House className="h-4 w-4 shrink-0 text-fuchsia-600 dark:text-fuchsia-400" />
          <h3 className="text-sm font-semibold text-foreground">Remote work requests</h3>
          {pendingCount > 0 && (
            <Badge variant="warning" data-test="remote-work-pending-count">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowAll((v) => !v)}
          data-test="remote-work-toggle-history"
        >
          {showAll ? 'Show pending only' : 'Show all'}
        </Button>
      </div>

      {isError && <p className="text-sm text-destructive">Failed to load remote work requests.</p>}
      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isPending && !isError && requests.length === 0 && (
        <p className="text-sm text-muted-foreground" data-test="remote-work-queue-empty">
          {showAll ? 'No remote work requests yet.' : 'Nothing waiting on a decision.'}
        </p>
      )}

      {!isPending && !isError && requests.length > 0 && (
        <ul className="divide-y divide-border/60" data-test="remote-work-queue-list">
          {requests.map((request) => {
            const badge = STATUS_BADGE[request.status] || {
              variant: 'secondary',
              label: request.status,
            };
            return (
              <li
                key={request.id}
                className="space-y-2 py-3"
                data-test={`remote-work-queue-row-${request.id}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-sm font-semibold text-foreground">
                    {request.intern.fullname}
                  </span>
                  {/* Every day, not just the first — the admin is deciding all of
                      them at once and has to see what they are agreeing to. */}
                  <span className="text-sm text-muted-foreground">
                    {request.dates?.length
                      ? request.dates.map(formatDay).join(' · ')
                      : 'No days on this request'}
                  </span>
                  {request.dates?.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      ({request.dates.length} days)
                    </span>
                  )}
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {request.intern.hub && (
                    <span className="text-xs text-muted-foreground">{request.intern.hub}</span>
                  )}
                </div>

                {request.reason && (
                  <p className="text-xs text-muted-foreground">“{request.reason}”</p>
                )}
                {request.decisionNote && (
                  <p className="text-xs text-muted-foreground">
                    Decision note: “{request.decisionNote}”
                  </p>
                )}

                {request.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={noteFor(request.id)}
                      onChange={(e) => setNote(request.id, e.target.value)}
                      placeholder="Note (optional, shown to the intern)"
                      className="h-8 max-w-xs text-xs"
                      maxLength={500}
                      data-test={`remote-work-note-${request.id}`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={busy}
                      onClick={() =>
                        decide({
                          id: request.id,
                          decision: 'approved',
                          note: noteFor(request.id),
                        })
                      }
                      data-test={`remote-work-approve-${request.id}`}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={busy}
                      onClick={() =>
                        decide({
                          id: request.id,
                          decision: 'rejected',
                          note: noteFor(request.id),
                        })
                      }
                      data-test={`remote-work-reject-${request.id}`}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                )}

                {request.status === 'approved' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={busy}
                    onClick={() => revoke({ id: request.id, note: noteFor(request.id) })}
                    title="Removes every day of this request from the intern's attendance"
                    data-test={`remote-work-revoke-${request.id}`}
                  >
                    <Undo2 className="mr-1 h-3 w-3" />
                    Revoke approval
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
