import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, AlarmClockOff, CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  todayRecord,
  isCancelledToday,
  formatCheckInTime,
  checkInWindowState,
  checkInWindowMinutesLeft,
  formatMinutesLeft,
  isExemptToday,
  isOfficeWeekend,
  nonWorkingKeySet,
  nonWorkingLabel,
  officeDateKey,
  requestedStatusToday,
  dayStatusLabel,
  CHECK_IN_WINDOW_LABEL,
} from '@/helpers/attendance';

/** The mockup's 36px bar action — one notch taller than the app's 34px controls. */
const ACTION_CLASS = 'h-9 rounded-[var(--r-control)] px-4 text-[13px] font-medium';

/**
 * The page header for an intern's attendance, and the ONLY place attendance is
 * mutable. Title and purpose on the left, today's standing on the right.
 *
 * The two used to be separate cards — a `PageHeading` above a `CheckInCard` — which
 * put the single most time-sensitive fact on the page ("the window closes at 11:00")
 * in its own band below the title. They are one card because they answer one
 * question: what does today need from me?
 *
 * Flow:
 *   not-in → [Check in] → checked-in → [Cancel check-in] (confirm) → cancelled
 *   → [Check in] again while the window is open.
 * Cancelling unchecks today; the intern can check in again until the window closes.
 * After it closes, a cancelled day counts as absent.
 *
 * Once the intern is on a real project (`placedAt`) the control is withdrawn
 * entirely — the server refuses check-in with a 422, so offering the button would
 * only produce an error on click. An approved day off (vacation, sick leave, a
 * religious holiday, a remote day) withdraws it too, and so does a cohort-wide
 * non-working day: there is nothing to check in for, and the badge says which kind
 * of day it is instead. The set of days withdrawn here mirrors the set the server
 * refuses in `checkIn` — when one moves, move the other.
 */
export default function AttendanceHeaderCard({
  records = [],
  cancelledDates = [],
  placedAt = null,
  requestedDays = {},
  // Cohort-wide days off (public holiday, programme break, remote week). Without
  // them this card offered a check-in on a holiday, and the server accepted a row
  // that `computeMonthStats` then dropped from both sides of the rate.
  nonWorkingDays = [],
  onCheckIn,
  onCancel,
  isCheckingIn,
  isCancelling,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* The bar prints a live countdown ("closes in 2h 14m"), so `now` has to be state
     rather than a fresh `new Date()` per render — nothing else on this page
     re-renders on its own, and a countdown frozen at mount is worse than none.
     Thirty seconds keeps the minute honest without spinning. */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = todayRecord(records);
  const cancelled = isCancelledToday(cancelledDates);
  // Office time on both, so the card agrees with the day and the window the server
  // is enforcing rather than with the viewer's own clock.
  const weekend = isOfficeWeekend(now);
  const windowState = checkInWindowState(now); // 'before' | 'open' | 'closed'
  // On a project as of today. Back-dating `placedAt` flips this immediately, which
  // is the point: the intern stops being asked for something they no longer owe.
  const exempt = isExemptToday(placedAt, now);
  const todayKey = officeDateKey(now);
  const cohortDayOff = nonWorkingKeySet(nonWorkingDays).has(todayKey);

  // What an approved request wrote for today, if anything. Checked before
  // `checkedIn` because a remote day is in `records` too and would otherwise report
  // as an ordinary office check-in.
  const requestedToday = requestedStatusToday(requestedDays);
  const onApprovedDay = Boolean(requestedToday);
  const checkedIn = !onApprovedDay && Boolean(today);

  // Cancelled only locks as absent once the window has closed; while it's still open
  // (or not yet open), the intern can check in again.
  // Every "you are absent" state is suppressed on a day the intern owed nothing on —
  // on a project, an approved day off, a cohort non-working day. None is an absence.
  const suppressed = exempt || onApprovedDay || cohortDayOff;
  const lockedAbsent = !suppressed && cancelled && windowState === 'closed';
  const missed = !suppressed && !checkedIn && !cancelled && !weekend && windowState === 'closed';
  const canCheckInAgain = !suppressed && cancelled && !weekend && windowState !== 'closed';
  const alarming = lockedAbsent || missed;

  /* "Check-in window 07:00–11:00 · closes in 2h 14m" — the mockup's second line.
     The countdown is dropped rather than shown as "0m" once the boundary passes:
     `formatMinutesLeft` returns null outside the window, and the line degrades to
     the plain window rather than counting down to a time that has already gone. */
  const countdown = formatMinutesLeft(checkInWindowMinutesLeft(now));
  const windowLine = `Check-in window ${CHECK_IN_WINDOW_LABEL}${
    countdown ? ` · ${windowState === 'before' ? 'opens' : 'closes'} in ${countdown}` : ''
  }`;

  const statusLine = exempt
    ? "You're on a project — recording attendance is no longer required."
    : onApprovedDay
      ? `Approved ${dayStatusLabel(requestedToday).toLowerCase()} — no check-in needed today.`
      : cohortDayOff
        ? `${nonWorkingLabel(nonWorkingDays, todayKey) || 'A non-working day'} — nobody is expected in, and today is not counted as an absence.`
        : lockedAbsent
          ? 'Check-in cancelled — today counts as absent.'
          : checkedIn
            ? `Checked in at ${formatCheckInTime(today.checkedInAt)}`
            : weekend
              ? "It's the weekend — check-in isn't required today."
              : missed
                ? `Check-in window ${CHECK_IN_WINDOW_LABEL} has closed — today counts as absent.`
                : canCheckInAgain
                  ? `Check-in was cancelled — you can check in again. ${windowLine}`
                  : windowLine;

  // One pill, whichever state today is in. The check-in button replaces it when
  // there is actually something to do — an intern should never have to read a
  // sentence to find out whether they can act.
  const badge = exempt
    ? { label: 'On a project', tone: 'muted', Icon: CalendarOff, test: 'on-project' }
    : onApprovedDay
      ? {
          label: dayStatusLabel(requestedToday),
          tone: 'muted',
          Icon: CalendarOff,
          test: 'approved-day',
        }
      : cohortDayOff
        ? { label: 'Non-working day', tone: 'muted', Icon: CalendarOff, test: 'non-working' }
        : lockedAbsent
          ? { label: 'Absent today', tone: 'danger', Icon: XCircle, test: 'cancelled' }
          : weekend
            ? { label: 'Weekend', tone: 'muted', Icon: CalendarOff, test: 'weekend' }
            : missed
              ? { label: 'Window closed', tone: 'danger', Icon: AlarmClockOff, test: 'missed' }
              : null;

  const confirmCancel = () => {
    onCancel();
    setConfirmOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          'app-card flex flex-col gap-3 px-[18px] py-[15px] sm:flex-row sm:items-center sm:justify-between sm:gap-5',
          checkedIn && !cancelled && 'ring-1 ring-inset ring-[hsl(var(--tone-success)/0.3)]',
          alarming && 'ring-1 ring-inset ring-[hsl(var(--tone-danger)/0.3)]'
        )}
        data-test="attendance-header-card"
      >
        {/* One bar, two lines: which day it is, and what that day currently needs.
            The standing explanation ("admins can see your attendance…") moved up to
            the page subtitle — it is true every day, so it was the one line here
            that never changed. */}
        <div className="flex min-w-0 flex-col gap-[3px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[13.5px] font-semibold leading-tight text-foreground">
              {format(now, 'EEEE, MMMM d')}
            </span>
            {badge && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                  badge.tone === 'danger'
                    ? 'bg-[hsl(var(--tone-danger)/0.1)] text-[hsl(var(--tone-danger-fg))]'
                    : 'bg-muted text-muted-foreground'
                )}
                data-test={`attendance-${badge.test}-badge`}
              >
                <badge.Icon className="h-3.5 w-3.5" />
                {badge.label}
              </span>
            )}
            {checkedIn && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--tone-success)/0.15)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--tone-success-fg))]"
                data-test="attendance-checked-in-badge"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Checked in
              </span>
            )}
          </div>

          <p
            className={cn(
              'text-[12.5px] leading-[1.45]',
              alarming ? 'text-[hsl(var(--tone-danger-fg))]' : 'text-muted-foreground'
            )}
            data-test="attendance-status-line"
          >
            {statusLine}
          </p>
        </div>

        {/* Only rendered when there is something to press. Every other state is
            already fully described by the badge and the line beside it. */}
        {!suppressed && !weekend && !lockedAbsent && !missed && (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {checkedIn ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={isCancelling}
                className={ACTION_CLASS}
                data-test="attendance-cancel-button"
              >
                <XCircle />
                {isCancelling ? 'Cancelling…' : 'Cancel check-in'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onCheckIn}
                disabled={isCheckingIn || windowState !== 'open'}
                className={ACTION_CLASS}
                title={
                  windowState === 'before'
                    ? `Check-in opens at ${CHECK_IN_WINDOW_LABEL.split('–')[0]}`
                    : undefined
                }
                data-test="attendance-check-in-button"
              >
                {isCheckingIn
                  ? 'Checking in…'
                  : windowState === 'before'
                    ? 'Check-in not open yet'
                    : 'Check in for today'}
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-test="attendance-cancel-dialog">
          <DialogHeader>
            <DialogTitle>Cancel today's check-in?</DialogTitle>
            <DialogDescription>
              This unchecks you for today. You can check in again while the window (
              {CHECK_IN_WINDOW_LABEL}) is still open. After it closes, today will count as{' '}
              <span className="font-semibold text-foreground">absent</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              data-test="attendance-cancel-dialog-dismiss-button"
            >
              Keep check-in
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmCancel}
              disabled={isCancelling}
              data-test="attendance-cancel-dialog-confirm-button"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
