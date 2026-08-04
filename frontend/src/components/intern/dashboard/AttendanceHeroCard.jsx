import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DAY_STATUS,
  dayStatusLabel,
  buildWeekStrip,
  weekAttendance,
  computeStreak,
  todayRecord,
  isCancelledToday,
  formatCheckInTime,
  checkInWindowState,
  CHECK_IN_WINDOW_LABEL,
} from '@/helpers/attendance';

// Cell tone per day status. The hero sits on a dark accent surface in both
// themes, so these are fully-opaque named colours rather than theme tokens — see
// `.dashboard-hero-surface` in index.css. Present and absent are at full
// strength on purpose: they are the only two cells carrying a verdict, and a
// washed-out one is easy to skim past on a coloured background.
const CELL_CLASS = {
  [DAY_STATUS.PRESENT]: 'bg-emerald-500 shadow-sm shadow-emerald-950/30',
  [DAY_STATUS.ABSENT]: 'bg-red-500 shadow-sm shadow-red-950/30',
  // Today, still open: an outline rather than a fill, so the strip reads as
  // "this one is still yours to claim" instead of as an already-missed day.
  [DAY_STATUS.TODAY_PENDING]: 'border-2 border-dashed border-white/65 bg-white/[0.08]',
  [DAY_STATUS.FUTURE]: 'bg-black/20',
  [DAY_STATUS.WEEKEND]: 'bg-black/10',
};

/** Ticks once a minute — the clock only renders to the minute. */
const useOfficeClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Align the first tick to the top of the next minute so the displayed time
    // never lags by up to 59s behind the real one.
    let interval;
    const timeout = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), 60_000);
      },
      (60 - new Date().getSeconds()) * 1000
    );

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  return now;
};

/**
 * The intern board's one inverted surface: today's check-in, the streak it
 * protects, and how the week is going.
 *
 * Reads and writes `GET /api/attendance/me` through the same hooks
 * `MyAttendancePage` uses, so the two screens can never disagree about whether
 * today is checked in. Everything below the button is derived client-side from
 * the record history that endpoint already returns.
 */
export function AttendanceHeroCard({
  records = [],
  cancelledDates = [],
  month,
  onCheckIn,
  isCheckingIn,
}) {
  const now = useOfficeClock();

  const today = todayRecord(records);
  const checkedIn = Boolean(today);
  const cancelled = isCancelledToday(cancelledDates);
  const windowState = checkInWindowState(now);
  const streak = computeStreak(records);

  const week = buildWeekStrip(records, cancelledDates, now);
  const { present: weekPresent, elapsed: weekElapsed } = weekAttendance(week);

  const weekend = week.find((day) => day.isToday)?.status === DAY_STATUS.WEEKEND;
  const missed = !checkedIn && !weekend && windowState === 'closed';

  const statusLine = checkedIn
    ? `Checked in at ${formatCheckInTime(today.checkedInAt)}`
    : weekend
      ? 'Weekend — no check-in needed'
      : missed
        ? cancelled
          ? 'Check-in cancelled — today counts as absent'
          : 'Window closed — today counts as absent'
        : windowState === 'before'
          ? `Opens at ${CHECK_IN_WINDOW_LABEL.split('–')[0]}`
          : 'Not checked in yet';

  return (
    <section
      data-tour="intern-dashboard-attendance"
      className="dashboard-hero-surface flex min-h-[12.5rem] flex-col rounded-[1.25rem] p-4 sm:p-5"
      aria-label="Daily attendance"
    >
      <header className="flex items-start justify-between gap-2">
        <h2 className="dashboard-hero-muted flex items-center gap-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.16em]">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              checkedIn ? 'bg-emerald-400' : missed ? 'bg-red-400' : 'bg-amber-400'
            )}
            aria-hidden="true"
          />
          Daily attendance
        </h2>
        <span className="dashboard-hero-muted shrink-0 text-[11px] font-medium">
          {format(now, 'MMM d')}
        </span>
      </header>

      <p className="dashboard-hero-text mt-2 text-[2.5rem] font-semibold leading-none tabular-nums">
        {format(now, 'h:mm')}
        <span className="ml-1.5 align-baseline text-base font-medium">{format(now, 'a')}</span>
      </p>

      {/* Status and streak share a baseline — the streak is context for the
          status ("not in yet, and you have 12 days riding on it"), not a
          headline of its own. */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="dashboard-hero-text min-w-0 truncate text-[15px] font-semibold">
          {statusLine}
        </p>
        {streak > 0 && (
          <p className="flex shrink-0 items-baseline gap-1.5">
            <span className="dashboard-hero-text text-lg font-bold leading-none tabular-nums">
              {streak}
            </span>
            <span className="dashboard-hero-muted text-[10px] font-semibold uppercase tracking-[0.12em]">
              day{streak === 1 ? '' : 's'} streak
            </span>
          </p>
        )}
      </div>

      {/* The action floats in the middle of whatever space is left between the
          clock above and the week strip below, instead of sitting flush under the
          status line. The hero's height is set by the row, so that gap varies —
          `flex-1` on this wrapper means the button stays optically centred at any
          row height rather than drifting toward the top. */}
      <div className="flex flex-1 items-center py-4">
        {checkedIn || weekend || missed ? (
          <Link
            to="/my-attendance"
            className="inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/[0.18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            data-test="intern-dashboard-attendance-link"
          >
            {checkedIn ? 'View my attendance' : 'Open my attendance'}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onCheckIn}
            disabled={isCheckingIn || windowState !== 'open'}
            title={
              windowState === 'before'
                ? `Check-in opens at ${CHECK_IN_WINDOW_LABEL.split('–')[0]}`
                : undefined
            }
            data-test="intern-dashboard-check-in-button"
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50 disabled:shadow-none"
          >
            {isCheckingIn
              ? 'Checking in…'
              : windowState === 'before'
                ? 'Check-in not open yet'
                : 'Check in for today'}
          </button>
        )}
      </div>

      {/* The wrapper above already absorbs the free space, so the strip lands on
          the bottom edge without needing `mt-auto`. */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="dashboard-hero-muted text-[10px] font-semibold uppercase tracking-[0.16em]">
            This week
          </span>
          <span className="dashboard-hero-muted text-[11px] tabular-nums">
            {weekPresent} of {weekElapsed} days in
          </span>
        </div>

        {/* Chunky cells, as in the mockup. At strip height the week is meant to
            be read as a glance-able block of colour, not as a sparkline — a thin
            bar makes a missed day easy to miss. */}
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {week.map((day) => (
            <Tooltip key={day.key}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      'h-10 w-full rounded-lg',
                      CELL_CLASS[day.status] || CELL_CLASS[DAY_STATUS.FUTURE],
                      day.isToday && 'ring-1 ring-white/40 ring-offset-0'
                    )}
                  />
                  <span className="dashboard-hero-muted text-[10px] font-medium leading-none">
                    {day.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-medium">
                  {format(new Date(`${day.key}T12:00:00`), 'EEE d MMM')} ·{' '}
                  {dayStatusLabel(day.status)}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* The mockup had weekly hours on the right of this line. There is no
            check-out in the Attendance model, so hours are not derivable, and the
            average check-in time that stood in for them was not worth the space. */}
        <div className="dashboard-hero-muted mt-2.5 text-[11px] tabular-nums">
          {month?.attendanceRate ?? 0}% attendance this month · {month?.presentDays ?? 0} days
        </div>
      </div>
    </section>
  );
}
