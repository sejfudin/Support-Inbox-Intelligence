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
  CHECK_IN_WINDOW_LABEL,
} from '@/helpers/attendance';

/**
 * The intern's daily check-in control. This is the ONLY place attendance is
 * mutable. Flow:
 *   not-in → [Check in] → checked-in → [Cancel check-in] (confirm) → cancelled
 * Cancelling is one-way: the day is locked as absent and cannot be checked in
 * again. Use it only when a check-in was a mistake or the intern has to leave.
 *
 * @param {{
 *   records: Array<{date:string, checkedInAt:string}>,
 *   cancelledDates: string[],
 *   onCheckIn: () => void,
 *   onCancel: () => void,
 *   isCheckingIn: boolean,
 *   isCancelling: boolean,
 * }} props
 */
export default function CheckInCard({
  records = [],
  cancelledDates = [],
  onCheckIn,
  onCancel,
  isCheckingIn,
  isCancelling,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const now = new Date();
  const today = todayRecord(records);
  const checkedIn = Boolean(today);
  const cancelled = isCancelledToday(cancelledDates);
  const weekend = isWeekend(now);
  const windowState = checkInWindowState(now); // 'before' | 'open' | 'closed'
  const missed = !checkedIn && !cancelled && !weekend && windowState === 'closed';

  const statusLine = cancelled
    ? "Check-in cancelled — today counts as absent. You can't check in again today."
    : checkedIn
      ? `Checked in at ${formatCheckInTime(today.checkedInAt)}`
      : weekend
        ? "It's the weekend — check-in isn't required today."
        : missed
          ? `Check-in window (${CHECK_IN_WINDOW_LABEL}) has closed — today counts as absent.`
          : windowState === 'before'
            ? `Check-in opens at ${CHECK_IN_WINDOW_LABEL.split('–')[0]}.`
            : `Check in before ${CHECK_IN_WINDOW_LABEL.split('–')[1]}.`;

  const confirmCancel = () => {
    onCancel();
    setConfirmOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          'app-panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6',
          checkedIn && !cancelled && 'ring-1 ring-inset ring-emerald-500/30',
          (cancelled || missed) && 'ring-1 ring-inset ring-red-500/30'
        )}
        data-test="attendance-check-in-card"
      >
        <div className="min-w-0">
          <div className="app-kicker mb-1">Daily check-in</div>
          <p className="text-lg font-semibold text-foreground">{format(now, 'EEEE, MMMM d')}</p>
          <p
            className={cn(
              'mt-1 flex items-center gap-1.5 text-sm',
              cancelled || missed ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
            )}
          >
            {cancelled ? (
              <Ban className="h-3.5 w-3.5 shrink-0" />
            ) : weekend ? (
              <CalendarOff className="h-3.5 w-3.5 shrink-0" />
            ) : missed ? (
              <AlarmClockOff className="h-3.5 w-3.5 shrink-0" />
            ) : windowState === 'before' ? (
              <Hourglass className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Clock className="h-3.5 w-3.5 shrink-0" />
            )}
            {statusLine}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {cancelled ? (
            <div
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-300"
              data-test="attendance-cancelled-badge"
            >
              <XCircle className="h-4 w-4" />
              Absent today
            </div>
          ) : checkedIn ? (
            <>
              <div
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
                data-test="attendance-checked-in-badge"
              >
                <CheckCircle2 className="h-4 w-4" />
                Checked in
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setConfirmOpen(true)}
                disabled={isCancelling}
                data-test="attendance-cancel-button"
              >
                <XCircle className="mr-2 h-4 w-4" />
                {isCancelling ? 'Cancelling…' : 'Cancel check-in'}
              </Button>
            </>
          ) : weekend ? (
            <div
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground"
              data-test="attendance-weekend-badge"
            >
              <CalendarOff className="h-4 w-4" />
              Weekend
            </div>
          ) : missed ? (
            <div
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-300"
              data-test="attendance-missed-badge"
            >
              <AlarmClockOff className="h-4 w-4" />
              Window closed
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              className="w-full md:w-auto"
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
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-test="attendance-cancel-dialog">
          <DialogHeader>
            <DialogTitle>Cancel today's check-in?</DialogTitle>
            <DialogDescription>
              This can't be undone. Today will be marked{' '}
              <span className="font-semibold text-foreground">absent</span> and you won't be able to
              check in again today. Only cancel if you checked in by mistake or have to leave.
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
