import { useEffect, useMemo, useState } from 'react';
import { format, isWeekend } from 'date-fns';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { officeDateKey, formatRequestDates, isRequestActive } from '@/helpers/attendance';
import { DayStatusGlyph, dayStatusDot } from '@/components/attendance/dayStatusVisuals';
import AbsenceRequestHistory from '@/components/attendance/AbsenceRequestHistory';
import {
  useMyAbsenceRequests,
  useCreateAbsenceRequest,
  useCancelAbsenceRequest,
} from '@/queries/absenceRequests';
import PanelBodySkeleton from '@/components/Skeletons/PanelBodySkeleton';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

const formatDay = (key) => format(new Date(`${key}T12:00:00`), 'EEE, d MMM');

// The bar fill per type, matching the calendar's own colours so a row and a day
// cell are recognisably the same thing.
const BAR_FILL = {
  vacation: 'bg-[hsl(var(--tone-info))]',
  religious: 'bg-[hsl(var(--tone-violet))]',
  sick: 'bg-[hsl(var(--tone-orange))]',
  remote: 'bg-[hsl(var(--tone-cyan))]',
};

// One line per type explaining what it costs the intern. Everything numeric comes
// from the server's `types` payload; this is only the part a number cannot say.
const TYPE_BLURB = {
  remote: 'An approved day counts as attendance. You do not check in for it.',
  vacation: 'Approved days are time off — they do not count against your attendance.',
  religious: 'For an observance the shared calendar does not already cover.',
  sick: 'One day per request. File another if you are ill for longer.',
};

const REQUEST_BUDGET_STATUSES = new Set(['pending', 'approved']);
const requestYear = (dateKey) => String(dateKey).slice(0, 4);

/**
 * One row of the balance: what this kind of day has cost the intern this year.
 *
 * Budgeted types get a fraction and a bar. **Unbudgeted ones get a count and no
 * bar** — remote work and sick days have no yearly ceiling, so there is no
 * denominator to draw against, and a bar without one would imply a limit the rules
 * do not enforce.
 */
function BalanceRow({ type, label, budget, used }) {
  const pct = budget ? Math.min(100, Math.round((budget.used / budget.budget) * 100)) : 0;

  return (
    <li className="space-y-1.5" data-test={`absence-balance-${type}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm text-foreground">
          <DayStatusGlyph status={type} className="opacity-70" />
          {label}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {budget ? (
            <>
              <span
                className={cn(
                  'font-semibold',
                  budget.remaining === 0 ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {budget.remaining}
              </span>{' '}
              of {budget.budget} left
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">{used}</span> used
            </>
          )}
        </span>
      </div>
      {budget && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', BAR_FILL[type])}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </li>
  );
}

/**
 * "Absence balance": what each kind of day has cost the intern this year, when the
 * next one falls, and the way to ask for another.
 *
 * Sits in a narrow column beside the calendar, so it stays a summary. The full list
 * of requests — including anything still waiting, and the withdraw action — lives
 * behind "View history", because a year of rows would push the calendar off screen
 * and is not what this card is for.
 *
 * Four types share one request form. Choosing a type reconfigures it from the
 * server's `types` payload — the ceiling, the current-year balance, and the date
 * bounds. The picker mirrors the server's per-year budget check only to keep
 * impossible dates disabled; `server/helpers/absenceRequestRules.js` remains
 * the authority on submission.
 */
export default function AbsenceRequestPanel({ recordedDates = [], className }) {
  const { data, isPending: isPendingRaw, isError } = useMyAbsenceRequests();
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });
  const { mutate: createRequest, isPending: isSubmitting } = useCreateAbsenceRequest();
  const { mutate: cancelRequest, isPending: isCancelling } = useCancelAbsenceRequest();

  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [type, setType] = useState('remote');
  const [dates, setDates] = useState([]);
  const [draftDate, setDraftDate] = useState('');
  const [reason, setReason] = useState('');
  const [recipientAdmin, setRecipientAdmin] = useState('');

  const requests = useMemo(() => data?.requests ?? [], [data]);
  const types = useMemo(() => data?.types ?? [], [data]);
  const admins = useMemo(() => data?.admins ?? [], [data]);
  const active = types.find((t) => t.type === type) || null;

  // The soonest day still ahead of the intern, across everything live. Pending
  // included on purpose — "next away" is what they are planning around, and a day
  // waiting on an admin is still the day they have in mind.
  const nextAway = useMemo(() => {
    const todayKey = officeDateKey();
    const days = requests
      .filter((request) => isRequestActive(request, todayKey))
      .flatMap((request) => request.dates || [])
      .filter((date) => date >= todayKey)
      .sort();
    return days[0] || null;
  }, [requests]);

  const maxDays = active?.maxDaysPerRequest ?? 1;
  const currentYear = officeDateKey().slice(0, 4);
  const currentYearSpent = Boolean(active?.budget && active.budget.remaining === 0);
  const isFull = dates.length >= maxDays;

  // `types[].budget` is intentionally current-year only. Rebuild the same
  // spent-by-year map the server uses, otherwise a full 2026 allowance would
  // incorrectly block a valid 2027 request in the date picker.
  const usedByYear = useMemo(() => {
    const used = new Map();
    if (!active?.budget) return used;

    for (const request of requests) {
      if ((request.type || 'remote') !== active.type) continue;
      if (!REQUEST_BUDGET_STATUSES.has(request.status)) continue;

      for (const date of request.dates || []) {
        const year = requestYear(date);
        used.set(year, (used.get(year) || 0) + 1);
      }
    }

    return used;
  }, [active?.budget, active?.type, requests]);

  const wouldExceedYearBudget = (nextDate, selectedDates) => {
    if (!active?.budget) return false;

    const wantedByYear = new Map();
    for (const date of [...selectedDates, nextDate]) {
      const year = requestYear(date);
      wantedByYear.set(year, (wantedByYear.get(year) || 0) + 1);
    }

    for (const [year, wanted] of wantedByYear) {
      if ((usedByYear.get(year) || 0) + wanted > active.budget.budget) return true;
    }

    return false;
  };

  // Trim the selection when switching to a type with a smaller ceiling, so the form
  // can never submit more days than the type allows.
  useEffect(() => {
    setDates((prev) => (prev.length > maxDays ? prev.slice(0, maxDays) : prev));
  }, [maxDays]);

  // Days the server would refuse outright: already claimed by a request that is
  // still live, or already recorded as attendance. Offering them and then rejecting
  // the whole submission is a wasted round-trip and reads as a bug — the calendar
  // should simply not present them.
  const unavailable = useMemo(() => {
    const taken = new Set(recordedDates);
    for (const request of requests) {
      if (request.status !== 'pending' && request.status !== 'approved') continue;
      for (const date of request.dates) taken.add(date);
    }
    return taken;
  }, [requests, recordedDates]);

  const openForm = () => {
    // Defaults to the configured primary admin every time the dialog opens,
    // never carried over from a previous request — the last request's pick was
    // a deliberate choice for that request, not a standing preference.
    setRecipientAdmin(data?.primaryAdmin?.id ?? '');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setDates([]);
    setDraftDate('');
    setReason('');
    setRecipientAdmin('');
  };

  const chooseType = (next) => {
    setType(next);
    setDates([]);
    setDraftDate('');
  };

  // Clicking a day toggles it. The calendar stays open (`closeOnSelect={false}`), so
  // picking three days is three clicks rather than three open-pick-reopen cycles,
  // and a mis-click is undone in place.
  const toggleDate = (value) => {
    setDraftDate('');
    if (!value) return;
    setDates((prev) => {
      if (prev.includes(value)) return prev.filter((d) => d !== value);
      if (prev.length >= maxDays) return prev;
      if (wouldExceedYearBudget(value, prev)) return prev;
      return [...prev, value].sort();
    });
  };

  const removeDate = (value) => setDates((prev) => prev.filter((d) => d !== value));

  const submit = (event) => {
    event.preventDefault();
    if (dates.length === 0 || !recipientAdmin) return;
    createRequest({ type, dates, reason, recipientAdmin }, { onSuccess: closeForm });
  };

  // Everything the client can rule out without asking. Holidays and the placement
  // boundary still need server state, so the response stays the authority — this
  // just keeps the obvious refusals off the calendar.
  //
  // The bounds come from the server too: `earliestDate` is today for most types and
  // two working days back for a sick day, and `latestDate` is set only for sick,
  // which cannot be booked ahead.
  const isDateDisabled = (day) => {
    const key = format(day, 'yyyy-MM-dd');
    if (isWeekend(day) || unavailable.has(key)) return true;
    if (key < (active?.earliestDate || officeDateKey())) return true;
    if (active?.latestDate && key > active.latestDate) return true;
    // At the ceiling, only the days already picked stay clickable — so they can
    // still be un-picked.
    if (dates.includes(key)) return false;
    if (isFull) return true;
    return wouldExceedYearBudget(key, dates);
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div
      className={cn('app-card flex flex-col p-4 md:p-5', className)}
      data-test="absence-request-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Absence balance</h3>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="shrink-0 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          data-test="absence-request-view-history"
        >
          View history
          {pendingCount > 0 && (
            <span className="ml-1 text-muted-foreground">({pendingCount} waiting)</span>
          )}
        </button>
      </div>

      {isError && (
        <p className="mt-4 text-sm text-[hsl(var(--tone-danger-fg))]">
          Failed to load your balance.
        </p>
      )}
      {isPending && (
        <LoadingOverlay size="sm" label="Loading balance">
          <PanelBodySkeleton rows={4} className="mt-1" />
        </LoadingOverlay>
      )}

      {!isPending && !isError && (
        <ul className="mt-4 space-y-3" data-test="absence-balance-list">
          {types.map((t) => (
            <BalanceRow
              key={t.type}
              type={t.type}
              label={t.label}
              budget={t.budget}
              used={t.used ?? 0}
            />
          ))}
        </ul>
      )}

      {/* Pushed to the bottom so the card's footer lines up with the calendar's,
          however tall the column grows. */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <p className="text-xs text-muted-foreground" data-test="absence-next-away">
          {nextAway ? (
            <>
              Next away{' '}
              <span className="font-semibold text-foreground">
                · {format(new Date(`${nextAway}T12:00:00`), 'EEE d MMM')}
              </span>
            </>
          ) : (
            'Nothing booked'
          )}
        </p>
        <Button type="button" size="sm" onClick={openForm} data-test="absence-request-button">
          Request absence
        </Button>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-3xl" data-test="absence-history-dialog">
          <DialogHeader>
            <DialogTitle>Request history</DialogTitle>
            <DialogDescription>
              Everything you have asked for this year, decided or not.
            </DialogDescription>
          </DialogHeader>
          <AbsenceRequestHistory
            requests={requests}
            onWithdraw={(id) => cancelRequest(id)}
            isWithdrawing={isCancelling}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
        <DialogContent className="sm:max-w-lg" data-test="absence-request-dialog">
          <DialogHeader>
            <DialogTitle>Request time away</DialogTitle>
            <DialogDescription>
              An admin decides the whole request at once — every day in it, or none.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>What are you asking for?</Label>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Request type">
                {types.map((t) => {
                  const selected = t.type === type;
                  return (
                    <button
                      key={t.type}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => chooseType(t.type)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-[var(--r-control)] border px-2.5 py-1.5 text-xs font-medium transition-colors',
                        selected
                          ? 'border-foreground/30 bg-muted text-foreground'
                          : 'border-border/60 text-muted-foreground hover:bg-muted/50'
                      )}
                      data-test={`absence-request-type-${t.type}`}
                    >
                      <DayStatusGlyph status={t.type} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {active && (
                <p className="pt-0.5 text-xs text-muted-foreground">{TYPE_BLURB[active.type]}</p>
              )}
            </div>

            {currentYearSpent && (
              <p
                className="rounded-[var(--r-control)] bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
                data-test="absence-request-current-year-spent"
              >
                You have used all {active.budget.budget} of your {active.label.toLowerCase()} days
                for {currentYear}. Future-year dates are still checked against that year&apos;s
                allowance.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="absence-request-date">
                {maxDays === 1 ? 'Day' : `Days (${dates.length} of ${maxDays})`}
              </Label>
              <DatePicker
                id="absence-request-date"
                value={draftDate}
                onChange={toggleDate}
                selectedDates={dates}
                closeOnSelect={false}
                triggerLabel={
                  dates.length === 0
                    ? undefined
                    : `${dates.length} day${dates.length === 1 ? '' : 's'} selected`
                }
                placeholder={active?.latestDate ? 'Pick the day you were ill' : 'Pick working days'}
                isDateDisabled={isDateDisabled}
                data-test="absence-request-date-picker"
              />
              {dates.length > 0 && (
                <ul
                  className="flex flex-wrap gap-1.5 pt-1"
                  data-test="absence-request-selected-days"
                >
                  {dates.map((date) => (
                    <li key={date}>
                      <button
                        type="button"
                        onClick={() => removeDate(date)}
                        className="inline-flex items-center gap-1 rounded-[var(--r-control)] border border-border/60 bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60"
                        aria-label={`Remove ${formatDay(date)}`}
                        data-test={`absence-request-selected-${date}`}
                      >
                        {formatDay(date)}
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {isFull && maxDays > 1 && (
                <p className="pt-1 text-xs text-muted-foreground">
                  That is the most one request can cover. Send this, then request the rest.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="absence-request-recipient">Send to</Label>
              <Select value={recipientAdmin} onValueChange={setRecipientAdmin}>
                <SelectTrigger id="absence-request-recipient" data-test="absence-request-recipient">
                  <SelectValue placeholder="Choose an admin" />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.fullname}
                      {admin.id === data?.primaryAdmin?.id ? ' (default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {admins.length === 0 && (
                <p className="text-xs text-[hsl(var(--tone-danger-fg))]">
                  No admin is available to send this to right now.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="absence-request-reason">Reason (optional)</Label>
              {/* `resize-none`: the box is two lines for a one-line reason, and a
                      drag handle in the corner of a short optional field invites
                      fiddling with the layout instead of filling it in. */}
              <Textarea
                id="absence-request-reason"
                rows={2}
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Anything the admin should know"
                className="resize-none"
                data-test="absence-request-reason-input"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={dates.length === 0 || !recipientAdmin || isSubmitting}
                data-test="absence-request-submit-button"
              >
                {isSubmitting ? 'Sending…' : 'Send request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
