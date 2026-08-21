import { useMemo, useState } from 'react';
import { addMonths, subMonths, isSameMonth, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  buildMonthGrid,
  DAY_STATUS,
  LEAVE_STATUSES,
  dayStatusLabel,
  nonWorkingKeySet,
  nonWorkingKind,
  nonWorkingLabel,
  officeDateKey,
} from '@/helpers/attendance';
import {
  dayStatusClass,
  dayStatusDot,
  DayStatusGlyph,
  ObservanceGlyph,
  STATUS_DOT,
} from '@/components/attendance/dayStatusVisuals';

// Monday-first week header. Weekend columns (Sat/Sun) are rendered disabled.
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const REMOTE_KIND = 'remote';

// How far ahead the "coming up" notice looks. A quarter is long enough that an
// intern planning a religious holiday sees it before they need to ask, and short
// enough that the line stays a line rather than becoming a second calendar.
const NOTICE_WINDOW_DAYS = 90;
const NOTICE_LIMIT = 3;

function LegendItem({ dotClass, label, Glyph }) {
  return (
    <div className="flex items-center gap-1.5">
      {Glyph ? (
        <Glyph aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
      ) : (
        <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Read-only month calendar visualizing an intern's attendance.
 *
 * @param {object} props
 *   initialMonth - 'YYYY-MM' to open on; defaults to the current month.
 *   placedAt - the intern's first day on a real project. Every day from it onward is
 *     inert: they are no longer obliged to record attendance, so those days are not
 *     absences.
 *   requestedDays - 'YYYY-MM-DD' → the status an approved request wrote
 *     (remote | vacation | religious | sick). Remote days are already in `records`
 *     because they count; the three leave statuses are not in `records` at all,
 *     because they leave the denominator instead.
 *   observances - religious holidays to mark. Notices only: they change nothing
 *     about attendance, so they are drawn under the date rather than as a fill.
 */
export default function AttendanceCalendar({
  className,
  records = [],
  cancelledDates = [],
  initialMonth,
  placedAt = null,
  nonWorkingDays = [],
  startDate = null,
  requestedDays = {},
  observances = [],
}) {
  const [cursor, setCursor] = useState(() =>
    initialMonth ? parseISO(`${initialMonth}-01`) : new Date()
  );
  const nonWorkingKeys = useMemo(() => nonWorkingKeySet(nonWorkingDays), [nonWorkingDays]);
  const { weeks, monthLabel } = useMemo(
    () =>
      buildMonthGrid(
        cursor,
        records,
        cancelledDates,
        placedAt,
        nonWorkingKeys,
        startDate,
        requestedDays
      ),
    [cursor, records, cancelledDates, placedAt, nonWorkingKeys, startDate, requestedDays]
  );

  // One date can carry more than one observance — the two Easters coincide some
  // years, and different traditions share days — so the tooltip joins them.
  const observanceByDate = useMemo(() => {
    const map = new Map();
    for (const item of observances) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date).push(item);
    }
    return map;
  }, [observances]);

  const upcoming = useMemo(() => {
    const today = officeDateKey();
    const horizon = new Date(Date.now() + NOTICE_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
    return observances
      .filter((item) => item.date >= today && item.date <= horizon)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, NOTICE_LIMIT);
  }, [observances]);

  const todayKey = officeDateKey();
  const atCurrentMonth = isSameMonth(cursor, new Date());

  const shownStatuses = useMemo(
    () =>
      new Set(
        weeks
          .flat()
          .filter(Boolean)
          .map((cell) => cell.status)
      ),
    [weeks]
  );
  const showsExempt = shownStatuses.has(DAY_STATUS.EXEMPT);
  // Split so the legend only offers the swatches actually on screen, and never
  // labels a remote week as a plain non-working day.
  const nonWorkingCells = weeks
    .flat()
    .filter((cell) => cell?.status === DAY_STATUS.NON_WORKING)
    .map((cell) => nonWorkingKind(nonWorkingDays, format(cell.date, 'yyyy-MM-dd')));
  // Either sort of remote cell — a cohort-wide remote week or this intern's own
  // approved remote day — earns the one "Remote" swatch.
  const showsRemote = nonWorkingCells.includes(REMOTE_KIND) || shownStatuses.has(DAY_STATUS.REMOTE);
  const showsNonWorking = nonWorkingCells.some((kind) => kind !== REMOTE_KIND);
  const shownLeave = LEAVE_STATUSES.filter((status) => shownStatuses.has(status));

  return (
    // `flex flex-col` + a growing grid is what lets the card fill whatever height
    // the column beside it sets: the day cells stretch, the card does not float in
    // a taller box with dead space under the last week.
    <div
      className={cn('app-card flex flex-col p-4 md:p-5', className)}
      data-test="attendance-calendar"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{monthLabel}</h3>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCursor((d) => subMonths(d, 1))}
            data-test="attendance-calendar-prev-button"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={atCurrentMonth}
            onClick={() => setCursor((d) => addMonths(d, 1))}
            data-test="attendance-calendar-next-button"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* `auto-rows-fr` divides the leftover height evenly across the week rows, so
          every cell grows by the same amount rather than the last one absorbing it.
          `min-h-9` keeps the short-month case from collapsing. */}
      <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1 [grid-template-rows:auto_repeat(auto-fill,minmax(0,1fr))]">
        {WEEKDAY_LABELS.map((label, i) => {
          const isWeekendCol = i >= 5; // Sat, Sun
          return (
            <div
              key={label}
              className={cn(
                'pb-0.5 text-center text-[10px] font-medium uppercase tracking-wide',
                isWeekendCol ? 'text-muted-foreground/40' : 'text-muted-foreground'
              )}
            >
              {label}
            </div>
          );
        })}

        {weeks.map((week, wi) =>
          week.map((cell, di) => {
            if (!cell) return <div key={`${wi}-${di}`} className="min-h-9" />;
            const { date, status } = cell;
            const dayKey = format(date, 'yyyy-MM-dd');
            const isToday = dayKey === todayKey;
            // A cohort-wide remote week is a NON_WORKING day, but it is the one kind
            // that should not read as a grey nothing-day — it gets the remote fill
            // while keeping its own label.
            const isRemoteWeek =
              status === DAY_STATUS.NON_WORKING &&
              nonWorkingKind(nonWorkingDays, dayKey) === REMOTE_KIND;
            const dayObservances = observanceByDate.get(dayKey) || [];
            const disabled =
              status === DAY_STATUS.WEEKEND ||
              status === DAY_STATUS.FUTURE ||
              status === DAY_STATUS.EXEMPT ||
              status === DAY_STATUS.NON_WORKING ||
              status === DAY_STATUS.BEFORE_START;

            const reason =
              status === DAY_STATUS.EXEMPT
                ? 'on a project, attendance not required'
                : status === DAY_STATUS.NON_WORKING
                  ? nonWorkingLabel(nonWorkingDays, dayKey) || 'not a working day'
                  : status === DAY_STATUS.BEFORE_START
                    ? 'before joining the programme'
                    : status === DAY_STATUS.REMOTE ||
                        status === DAY_STATUS.VACATION ||
                        status === DAY_STATUS.RELIGIOUS ||
                        status === DAY_STATUS.SICK
                      ? dayStatusLabel(status).toLowerCase()
                      : status.replace('-', ' ');

            const observanceNote = dayObservances.length
              ? ` · ${dayObservances
                  .map((o) => `${o.label}${o.provisional ? ' (date to be confirmed)' : ''}`)
                  .join(', ')}`
              : '';

            return (
              <div
                key={`${wi}-${di}`}
                aria-disabled={disabled || undefined}
                className={cn(
                  'relative flex min-h-9 flex-col items-center justify-center rounded-[var(--r-control)] text-xs font-medium',
                  dayStatusClass(isRemoteWeek ? DAY_STATUS.REMOTE : status, { isToday })
                )}
                title={`${format(date, 'EEE, MMM d')} — ${reason}${observanceNote}`}
                data-test={`attendance-day-${dayKey}`}
                data-status={status}
              >
                <span className="flex items-center gap-0.5 leading-none">
                  {format(date, 'd')}
                  <DayStatusGlyph status={isRemoteWeek ? DAY_STATUS.REMOTE : status} />
                </span>
                {dayObservances.length > 0 && (
                  // A notice, not a status: a hairline under the date, never a fill,
                  // so it cannot be mistaken for the day being off.
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 h-px w-3 rounded-full bg-current opacity-40"
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3.5 border-t border-border/60 pt-3">
        <LegendItem dotClass={dayStatusDot(DAY_STATUS.PRESENT)} label="Present" />
        <LegendItem dotClass={dayStatusDot(DAY_STATUS.ABSENT)} label="Absent" />
        <LegendItem dotClass={dayStatusDot(DAY_STATUS.WEEKEND)} label="Weekend" />
        {showsRemote && <LegendItem dotClass={STATUS_DOT[DAY_STATUS.REMOTE]} label="Remote" />}
        {shownLeave.map((status) => (
          <LegendItem key={status} dotClass={dayStatusDot(status)} label={dayStatusLabel(status)} />
        ))}
        {showsExempt && (
          <LegendItem dotClass={dayStatusDot(DAY_STATUS.EXEMPT)} label="On project" />
        )}
        {showsNonWorking && (
          <LegendItem dotClass={dayStatusDot(DAY_STATUS.NON_WORKING)} label="Non-working" />
        )}
      </div>

      {upcoming.length > 0 && (
        <div
          className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground"
          data-test="attendance-observance-notice"
        >
          <span className="font-medium text-foreground/80">Coming up</span>
          <ul className="mt-1.5 space-y-1">
            {upcoming.map((item) => (
              <li key={`${item.date}-${item.label}`} className="flex items-baseline gap-2">
                {/* One star for every tradition — the label names the holiday, so
                    the mark only has to say "observance". `items-baseline` on the
                    row would drop the icon onto the text baseline, hence the nudge. */}
                <ObservanceGlyph className="translate-y-0.5 text-muted-foreground/70" />
                <span className="tabular-nums text-muted-foreground/80">
                  {format(parseISO(item.date), 'EEE d MMM')}
                </span>
                <span>{item.label}</span>
                {item.provisional && (
                  // Bajram dates are announced rather than calculated. Saying so is
                  // the point — an intern booking leave around a date the app got
                  // wrong is the failure this notice exists to prevent.
                  <span className="text-muted-foreground/60">· to be confirmed</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
