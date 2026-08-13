import { useMemo, useState } from 'react';
import { format, parseISO, isWeekend } from 'date-fns';
import { House, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { officeDateKey } from '@/helpers/attendance';
import {
  useMyRemoteWork,
  useRequestRemoteWork,
  useCancelRemoteWorkRequest,
} from '@/queries/remoteWork';

// Mirrors the server's request statuses (server/models/RemoteWorkRequest.js).
// `pending` and `approved` are the two that still hold their days.
const STATUS_BADGE = {
  pending: { variant: 'warning', label: 'Waiting on admin' },
  approved: { variant: 'info', label: 'Approved' },
  rejected: { variant: 'destructive', label: 'Rejected' },
  cancelled: { variant: 'outline', label: 'Withdrawn' },
  revoked: { variant: 'destructive', label: 'Revoked' },
};

// Fallback only. The server sends `maxDaysPerRequest`; this keeps the form sane
// on the first render, before the query resolves.
const DEFAULT_MAX_DAYS = 3;

const formatDay = (key) => format(parseISO(key), 'EEE, d MMM');

/**
 * The intern's own remote-work requests: the form to ask for days, and the list
 * of what they have asked for.
 *
 * A request covers **1, 2 or 3 days, decided together**. Wanting a fourth means
 * sending a second request — and there is no limit on how many requests may be
 * open, which is what makes exam week (3 days, then 2) work.
 *
 * The days need not be consecutive, so this is an add-to-a-list picker rather
 * than a range: "Monday and Friday" has to be as easy to ask for as "Monday to
 * Wednesday".
 */
export default function RemoteWorkPanel({ recordedDates = [] }) {
  const { data, isPending, isError } = useMyRemoteWork();
  const { mutate: requestRemoteWork, isPending: isSubmitting } = useRequestRemoteWork();
  const { mutate: cancelRequest, isPending: isCancelling } = useCancelRemoteWorkRequest();

  const [showForm, setShowForm] = useState(false);
  const [dates, setDates] = useState([]);
  const [draftDate, setDraftDate] = useState('');
  const [reason, setReason] = useState('');

  const requests = data?.requests ?? [];
  const maxDays = data?.maxDaysPerRequest ?? DEFAULT_MAX_DAYS;
  const isFull = dates.length >= maxDays;

  // Days the server would refuse outright: already claimed by a request that is
  // still live, or already recorded as attendance. Offering them and then
  // rejecting the whole submission is a wasted round-trip and reads as a bug —
  // the calendar should simply not present them.
  const unavailable = useMemo(() => {
    const taken = new Set(recordedDates);
    for (const request of requests) {
      if (request.status !== 'pending' && request.status !== 'approved') continue;
      for (const date of request.dates) taken.add(date);
    }
    return taken;
  }, [requests, recordedDates]);

  const closeForm = () => {
    setShowForm(false);
    setDates([]);
    setDraftDate('');
    setReason('');
  };

  // Clicking a day toggles it. The calendar stays open (`closeOnSelect={false}`),
  // so picking three days is three clicks rather than three open-pick-reopen
  // cycles, and a mis-click is undone in place.
  const toggleDate = (value) => {
    setDraftDate('');
    if (!value) return;
    setDates((prev) => {
      if (prev.includes(value)) return prev.filter((d) => d !== value);
      if (prev.length >= maxDays) return prev;
      return [...prev, value].sort();
    });
  };

  const removeDate = (value) => setDates((prev) => prev.filter((d) => d !== value));

  const submit = (event) => {
    event.preventDefault();
    if (dates.length === 0) return;
    requestRemoteWork({ dates, reason }, { onSuccess: closeForm });
  };

  // Everything the client can rule out without asking. Holidays and the
  // placement boundary still need server state, so the response stays the
  // authority — this just keeps the obvious refusals off the calendar.
  const isDateDisabled = (day) => {
    const key = format(day, 'yyyy-MM-dd');
    if (isWeekend(day) || key < officeDateKey() || unavailable.has(key)) return true;
    // At the ceiling, only the days already picked stay clickable — so they can
    // still be un-picked.
    return isFull && !dates.includes(key);
  };

  return (
    <div className="app-panel p-4 md:p-5" data-test="remote-work-panel">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <House className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-600 dark:text-fuchsia-400" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Remote work</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ask an admin to approve up to {maxDays} days working from home. Need more? Send
              another request. An approved day counts as attendance; you do not check in for it.
            </p>
          </div>
        </div>

        {!showForm && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowForm(true)}
            data-test="remote-work-request-button"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Request
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl border border-border/60 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="remote-work-date">
              Days ({dates.length} of {maxDays})
            </Label>
            <DatePicker
              id="remote-work-date"
              value={draftDate}
              onChange={toggleDate}
              selectedDates={dates}
              closeOnSelect={false}
              triggerLabel={
                dates.length === 0
                  ? undefined
                  : `${dates.length} day${dates.length === 1 ? '' : 's'} selected`
              }
              placeholder="Pick working days"
              isDateDisabled={isDateDisabled}
              data-test="remote-work-date-picker"
            />
            {dates.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 pt-1" data-test="remote-work-selected-days">
                {dates.map((date) => (
                  <li key={date}>
                    <button
                      type="button"
                      onClick={() => removeDate(date)}
                      className="inline-flex items-center gap-1 rounded-md border border-transparent bg-fuchsia-500/15 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-800 transition-colors hover:bg-fuchsia-500/25 dark:bg-fuchsia-500/20 dark:text-fuchsia-300"
                      aria-label={`Remove ${formatDay(date)}`}
                      data-test={`remote-work-selected-${date}`}
                    >
                      {formatDay(date)}
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {isFull && (
              <p className="pt-1 text-xs text-muted-foreground">
                That is the most one request can cover. Send this, then request the rest.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="remote-work-reason">Reason (optional)</Label>
            {/* `resize-none`: the box is two lines for a one-line reason, and a
                drag handle in the corner of a short optional field invites
                fiddling with the layout instead of filling it in. */}
            <Textarea
              id="remote-work-reason"
              rows={2}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Anything the admin should know"
              className="resize-none"
              data-test="remote-work-reason-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={dates.length === 0 || isSubmitting}
              data-test="remote-work-submit-button"
            >
              {isSubmitting ? 'Sending…' : 'Send request'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isError && (
        <p className="text-sm text-destructive">Failed to load your remote work requests.</p>
      )}
      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isPending && !isError && requests.length === 0 && (
        <p className="text-sm text-muted-foreground" data-test="remote-work-empty">
          You have not requested any remote days yet.
        </p>
      )}

      {!isPending && !isError && requests.length > 0 && (
        <ul className="divide-y divide-border/60" data-test="remote-work-list">
          {requests.map((request) => {
            const badge = STATUS_BADGE[request.status] || {
              variant: 'secondary',
              label: request.status,
            };
            return (
              <li
                key={request.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5"
                data-test={`remote-work-request-${request.id}`}
              >
                {/* A request always names its days. The fallback is not cosmetic:
                    without it a row with no days renders as a bare status badge
                    with nothing to say what it is about, which is indistinguishable
                    from a layout bug. */}
                <span className="text-sm font-medium text-foreground">
                  {request.dates?.length ? (
                    request.dates.map(formatDay).join(' · ')
                  ) : (
                    <span className="text-muted-foreground">No days on this request</span>
                  )}
                </span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {request.decisionNote && (
                  <span className="text-xs text-muted-foreground">“{request.decisionNote}”</span>
                )}
                {request.status === 'pending' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 px-2 text-xs"
                    disabled={isCancelling}
                    onClick={() => cancelRequest(request.id)}
                    data-test={`remote-work-withdraw-${request.id}`}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Withdraw
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
