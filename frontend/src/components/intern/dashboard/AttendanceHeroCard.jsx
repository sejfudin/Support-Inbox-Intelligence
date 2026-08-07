import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DAY_STATUS,
  dayStatusLabel,
  buildWeekStrip,
  weekAttendance,
  computeStreak,
  nonWorkingKeySet,
  nonWorkingKind,
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
  // On a project: inert, but given its own amber rather than a weekend's grey —
  // the calendar marks these days the same way, and an intern reading both should
  // not have to work out that the blank cells and the amber ones are the same
  // thing. Softer than present/absent because it carries no verdict.
  [DAY_STATUS.EXEMPT]: 'bg-amber-400/60',
  // Holiday or programme break — same reasoning. A remote week is non-working too
  // but gets REMOTE_CELL, matching the calendar's blue.
  [DAY_STATUS.NON_WORKING]: 'bg-black/10',
};

const REMOTE_CELL = 'bg-sky-400/60';

// How long today's cell keeps its just-claimed emphasis. Long enough to be seen
// if you were looking at the button you pressed, short enough that it is over
// before you read the rest of the card.
const CLAIMED_MS = 900;

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
 * True for `CLAIMED_MS` after check-in flips false → true *during this mount*.
 *
 * The distinction matters: someone loading the page at 3pm is already checked in
 * and must not watch their day get claimed again on every navigation. Only the
 * transition animates, never the state.
 *
 * `checkedIn` is derived from the records the mutation writes into the cache
 * `onSuccess`, and there is no optimistic update on that mutation — so this can
 * only fire once the server has actually recorded the check-in. A failed one
 * animates nothing.
 */
const useJustCheckedIn = (checkedIn) => {
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const wasCheckedIn = useRef(checkedIn);

  useEffect(() => {
    const flipped = checkedIn && !wasCheckedIn.current;
    wasCheckedIn.current = checkedIn;
    if (!flipped) return undefined;

    setJustCheckedIn(true);
    const timeout = setTimeout(() => setJustCheckedIn(false), CLAIMED_MS);
    return () => clearTimeout(timeout);
  }, [checkedIn]);

  return justCheckedIn;
};

// Both hero actions — "Check in for today" and, once that is done, the link
// through to the attendance page — fill the same slot, so they must be the same
// size. Sharing the box here rather than repeating it: the two used to differ by
// one text step, which made the pill visibly shrink the instant you checked in.
// Callers add only colour and emphasis on top.
const HERO_ACTION_CLASS =
  'inline-flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

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
  // First day on a real project. From here the intern owes no attendance, so the
  // week strip greys out and the check-in affordance is withdrawn rather than
  // nagging them for days they are not expected in.
  placedAt = null,
  nonWorkingDays = [],
  onCheckIn,
  isCheckingIn,
  className,
}) {
  const now = useOfficeClock();
  const reduceMotion = useReducedMotion();

  const today = todayRecord(records);
  const checkedIn = Boolean(today);
  const justCheckedIn = useJustCheckedIn(checkedIn);
  const cancelled = isCancelledToday(cancelledDates);
  const windowState = checkInWindowState(now);
  const streak = computeStreak(records, placedAt);

  const week = buildWeekStrip(
    records,
    cancelledDates,
    now,
    placedAt,
    nonWorkingKeySet(nonWorkingDays)
  );
  const { present: weekPresent, elapsed: weekElapsed } = weekAttendance(week);

  const todayStatus = week.find((day) => day.isToday)?.status;
  const weekend = todayStatus === DAY_STATUS.WEEKEND;
  // On a project: today is inert, so nothing is "missed" and check-in is not offered.
  const exempt = todayStatus === DAY_STATUS.EXEMPT;
  const missed = !checkedIn && !weekend && !exempt && windowState === 'closed';

  // One switch for the whole card: with reduced motion every preset collapses to
  // an empty object, so the elements render as plain swaps. The check-in pill is
  // this card's primary control — it has to stay usable for someone who has asked
  // the OS for no animation, not merely be animated more politely.
  const pillMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.97 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.97 },
        transition: { duration: 0.14, ease: 'easeOut' },
      };

  // The streak rolls like an odometer rather than tweening through the numbers —
  // it only ever moves by one, so a count-up would be a single frame of nothing.
  // `popLayout` pulls the outgoing digit out of flow so the label beside it does
  // not shuffle sideways mid-roll.
  const streakMotion = reduceMotion
    ? {}
    : {
        initial: { y: '0.7em', opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: '-0.7em', opacity: 0 },
        transition: { duration: 0.22, ease: 'easeOut' },
      };

  const statusLine = exempt
    ? 'On a project'
    : checkedIn
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
      className={cn(
        'dashboard-hero-surface flex min-h-[12.5rem] flex-col rounded-[1.25rem] p-4 sm:p-5',
        className
      )}
      aria-label="Daily attendance"
    >
      <header className="flex items-start justify-between gap-2">
        <h2 className="dashboard-hero-muted flex items-center gap-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.16em]">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              // Exempt is neutral, not amber: amber reads as "still owed today".
              exempt
                ? 'bg-white/40'
                : checkedIn
                  ? 'bg-emerald-400'
                  : missed
                    ? 'bg-red-400'
                    : 'bg-amber-400'
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
            {/* `initial={false}` so arriving at a 12-day streak shows 12, rather
                than rolling it in on every page load. Only a change animates. */}
            <span className="dashboard-hero-text inline-flex overflow-hidden text-lg font-bold leading-none tabular-nums">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={streak} {...streakMotion}>
                  {streak}
                </motion.span>
              </AnimatePresence>
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
      {/* `mode="wait"` so the two never overlap — they occupy the same slot and a
          crossfade would briefly stack two pills. `initial={false}` keeps the
          first paint static; only the swap animates. */}
      <div className="flex flex-1 items-center py-4">
        <AnimatePresence mode="wait" initial={false}>
          {/* `exempt` belongs in this branch, not the button one: an intern on a
              project owes nothing, and the server refuses their check-in with a 422,
              so offering the control would only produce an error on click. */}
          {checkedIn || weekend || missed || exempt ? (
            <motion.div key="attendance-link" className="w-full" {...pillMotion}>
              <Link
                to="/my-attendance"
                className={cn(
                  HERO_ACTION_CLASS,
                  'bg-white/10 text-white/90 hover:bg-white/[0.18] focus-visible:outline-white/40'
                )}
                data-test="intern-dashboard-attendance-link"
              >
                {exempt
                  ? 'On a project — attendance not required'
                  : checkedIn
                    ? 'View my attendance'
                    : 'Open my attendance'}
              </Link>
            </motion.div>
          ) : (
            <motion.div key="check-in-button" className="w-full" {...pillMotion}>
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
                className={cn(
                  HERO_ACTION_CLASS,
                  'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-white/40',
                  'disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50 disabled:shadow-none'
                )}
              >
                {isCheckingIn
                  ? 'Checking in…'
                  : windowState === 'before'
                    ? 'Check-in not open yet'
                    : 'Check in for today'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
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
            bar makes a missed day easy to miss.

            Full-bleed to the card's edges, so the width comes from the cells
            rather than from padding the strip out. They are kept short for that
            reason: at 2.5rem the stretched cells read as seven progress bars, and
            flattening them to 1.75rem is what keeps the row reading as a week. */}
        <div className="mt-2 grid grid-cols-7 gap-2.5">
          {week.map((day) => (
            <Tooltip key={day.key}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1.5">
                  {/* The cell going from dashed outline to solid green is the
                      real state change, so it is the one thing worth pointing
                      at. `transition-colors` carries the fill; the pop is only
                      on the day just claimed, and only on the transition —
                      `justCheckedIn` is false for a page loaded already in. */}
                  <motion.span
                    animate={
                      justCheckedIn && day.isToday && !reduceMotion
                        ? { scale: [0.82, 1.06, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.42, ease: 'easeOut', times: [0, 0.6, 1] }}
                    className={cn(
                      'h-7 w-full rounded-lg transition-colors duration-300',
                      day.status === DAY_STATUS.NON_WORKING &&
                        nonWorkingKind(nonWorkingDays, day.key) === 'remote'
                        ? REMOTE_CELL
                        : CELL_CLASS[day.status] || CELL_CLASS[DAY_STATUS.FUTURE],
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
        {/* Only rendered when a rate exists. While exempt there is nothing to
            report, and the action pill already says why — repeating it here would
            just be the same sentence twice. */}
        {typeof month?.attendanceRate === 'number' && (
          <div className="dashboard-hero-muted mt-2.5 text-[11px] tabular-nums">
            {month.attendanceRate}% attendance this month · {month?.presentDays ?? 0} days
          </div>
        )}
      </div>
    </section>
  );
}
