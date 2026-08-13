import { useState } from 'react';
import { format, isWeekend } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  AlarmClockOff,
  Hourglass,
  CalendarOff,
} from 'lucide-react';
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
  isExemptToday,
  requestedStatusToday,
  dayStatusLabel,
  CHECK_IN_WINDOW_LABEL,
} from '@/helpers/attendance';

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
 * only produce an error on click. An approved day off withdraws it too: there is
 * nothing to check in for, and the badge says which kind of day it is instead.
 */
export default function AttendanceHeaderCard({
  records = [],
  cancelledDates = [],
  placedAt = null,
  requestedDays = {},
  onCheckIn,
  onCancel,
  isCheckingIn,
  isCancelling,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const now = new Date();
  const today = todayRecord(records);
  const cancelled = isCancelledToday(cancelledDates);
  const weekend = isWeekend(now);
  const windowState = checkInWindowState(now); // 'before' | 'open' | 'closed'
  // On a project as of today. Back-dating `placedAt` flips this immediately, which
  // is the point: the intern stops being asked for something they no longer owe.
  const exempt = isExemptToday(placedAt, now);

  // What an approved request wrote for today, if anything. Checked before
  // `checkedIn` because a remote day is in `records` too and would otherwise report
  // as an ordinary office check-in.
  const requestedToday = requestedStatusToday(requestedDays);
  const onApprovedDay = Boolean(requestedToday);
  const checkedIn = !onApprovedDay && Boolean(today);

  // Cancelled only locks as absent once the window has closed; while it's still open
  // (or not yet open), the intern can check in again.
  // Every "you are absent" state is suppressed while exempt or on an approved day —
  // neither is an absence, they simply owe nothing.
  const suppressed = exempt || onApprovedDay;
  const lockedAbsent = !suppressed && cancelled && windowState === 'closed';
  const missed = !suppressed && !checkedIn && !cancelled && !weekend && windowState === 'closed';
  const canCheckInAgain = !suppressed && cancelled && !weekend && windowState !== 'closed';
  const alarming = lockedAbsent || missed;

  const statusLine = exempt
    ? "You're on a project — recording attendance is no longer required."
    : onApprovedDay
      ? `Approved ${dayStatusLabel(requestedToday).toLowerCase()} — no check-in needed today.`
      : lockedAbsent
        ? 'Check-in cancelled — today counts as absent.'
        : checkedIn
          ? `Checked in at ${formatCheckInTime(today.checkedInAt)}`
          : weekend
            ? "It's the weekend — check-in isn't required today."
            : missed
              ? `Check-in window ${CHECK_IN_WINDOW_LABEL} has closed — today counts as absent.`
              : canCheckInAgain
                ? windowState === 'before'
                  ? `Check-in was cancelled. Opens again at ${CHECK_IN_WINDOW_LABEL.split('–')[0]}.`
                  : 'Check-in was cancelled — you can check in again.'
                : windowState === 'before'
                  ? `Check-in opens at ${CHECK_IN_WINDOW_LABEL.split('–')[0]}.`
                  : `Check in before ${CHECK_IN_WINDOW_LABEL.split('–')[1]}.`;

  const StatusIcon = exempt
    ? CalendarOff
    : onApprovedDay
      ? CalendarOff
      : lockedAbsent
        ? Ban
        : weekend
          ? CalendarOff
          : missed
            ? AlarmClockOff
            : windowState === 'before'
              ? Hourglass
              : Clock;

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
          'app-panel flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between md:p-6',
          checkedIn && !cancelled && 'ring-1 ring-inset ring-emerald-500/30',
          alarming && 'ring-1 ring-inset ring-red-500/30'
        )}
        data-test="attendance-header-card"
      >
        <div className="min-w-0">
          <div className="app-kicker mb-1">Internship</div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My attendance</h1>
          {/* Admins only — mentors have no attendance view. Saying "your mentor" here
              was untrue, and an intern who believed it would think a day off had been
              seen by someone who cannot see it. */}
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {exempt
              ? 'You are on a project, so you no longer record daily attendance. Your history up to that point is below.'
              : 'Check in each day you come into the office. Admins can see your attendance, but only you can record it.'}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 md:items-end">
          <div className="flex flex-wrap items-center gap-2.5 md:justify-end">
            <span className="text-sm font-semibold text-foreground">
              {format(now, 'EEEE, MMMM d')}
            </span>
            {badge && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                  badge.tone === 'danger'
                    ? 'bg-red-500/10 text-red-700 dark:text-red-300'
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
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                data-test="attendance-checked-in-badge"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Checked in
              </span>
            )}
          </div>

          <p
            className={cn(
              'flex items-center gap-1.5 text-sm md:justify-end',
              alarming ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
            )}
            data-test="attendance-status-line"
          >
            <StatusIcon className="h-3.5 w-3.5 shrink-0" />
            {statusLine}
          </p>

          {/* Only rendered when there is something to press. Every other state is
              already fully described by the badge and the line above it. */}
          {!suppressed && !weekend && !lockedAbsent && !missed && (
            <div className="flex flex-col items-stretch gap-2 pt-1 sm:flex-row md:justify-end">
              {checkedIn ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={isCancelling}
                  data-test="attendance-cancel-button"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {isCancelling ? 'Cancelling…' : 'Cancel check-in'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={onCheckIn}
                  disabled={isCheckingIn || windowState !== 'open'}
                  title={
                    windowState === 'before'
                      ? `Check-in opens at ${CHECK_IN_WINDOW_LABEL.split('–')[0]}`
                      : undefined
                  }
                  data-test="attendance-check-in-button"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
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
