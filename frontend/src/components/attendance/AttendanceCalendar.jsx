import { useMemo, useState } from 'react';
import { addMonths, subMonths, isSameMonth, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  buildMonthGrid,
  DAY_STATUS,
  nonWorkingKeySet,
  nonWorkingKind,
  nonWorkingLabel,
} from '@/helpers/attendance';

// Monday-first week header. Weekend columns (Sat/Sun) are rendered disabled.
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_STYLES = {
  [DAY_STATUS.PRESENT]:
    'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300',
  [DAY_STATUS.ABSENT]:
    'bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/25 dark:text-red-300',
  [DAY_STATUS.TODAY_PENDING]:
    'bg-primary/10 text-primary ring-1 ring-inset ring-primary/40 font-semibold',
  [DAY_STATUS.WEEKEND]: 'bg-muted/30 text-muted-foreground/40',
  [DAY_STATUS.FUTURE]: 'text-muted-foreground/40',
  // On a project: never an absence, but not a grey nothing-day either. Amber so a
  // placed intern's month reads as accounted for rather than blank, and so it
  // stops being indistinguishable from a weekend or a holiday. Blue is spoken for
  // by remote days below, emerald by Present, red by Absent, violet by Today.
  [DAY_STATUS.EXEMPT]:
    'bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300',
  // Holiday or programme break — nobody owed this day. Same grey as a weekend.
  // A remote week is also non-working but gets REMOTE_STYLE instead; see below.
  [DAY_STATUS.NON_WORKING]: 'bg-muted/30 text-muted-foreground/40',
  // Before the intern joined: faintest of all, and deliberately not a filled cell —
  // these days are not part of their record at all.
  [DAY_STATUS.BEFORE_START]: 'text-muted-foreground/30',
};

// A remote week is a NON_WORKING day like any other — it leaves the denominator
// the same way — but it is the one kind the intern was still expected to *work*,
// so it reads as its own thing rather than as a holiday.
const REMOTE_STYLE =
  'bg-sky-500/15 text-sky-700 ring-1 ring-inset ring-sky-500/30 dark:text-sky-300';

const REMOTE_KIND = 'remote';

const STATUS_DOT = {
  [DAY_STATUS.PRESENT]: 'bg-emerald-500',
  [DAY_STATUS.ABSENT]: 'bg-red-500',
  [DAY_STATUS.TODAY_PENDING]: 'bg-primary',
  [DAY_STATUS.EXEMPT]: 'bg-amber-500',
  [REMOTE_KIND]: 'bg-sky-500',
};

function LegendItem({ dotClass, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Read-only month calendar visualizing an intern's attendance.
 * @param {{ records: Array<{date:string}>, cancelledDates?: string[], initialMonth?: string,
 *   placedAt?: string|null }} props
 *   initialMonth - 'YYYY-MM' to open on; defaults to the current month.
 *   placedAt - the intern's first day on a real project. Every day from it onward is
 *     tinted blue and inert: they are no longer obliged to record attendance, so those
 *     days are not absences.
 */
export default function AttendanceCalendar({
  records = [],
  cancelledDates = [],
  initialMonth,
  placedAt = null,
  nonWorkingDays = [],
  startDate = null,
}) {
  const [cursor, setCursor] = useState(() =>
    initialMonth ? parseISO(`${initialMonth}-01`) : new Date()
  );
  const nonWorkingKeys = useMemo(() => nonWorkingKeySet(nonWorkingDays), [nonWorkingDays]);
  const { weeks, monthLabel } = useMemo(
    () => buildMonthGrid(cursor, records, cancelledDates, placedAt, nonWorkingKeys, startDate),
    [cursor, records, cancelledDates, placedAt, nonWorkingKeys, startDate]
  );
  const atCurrentMonth = isSameMonth(cursor, new Date());
  const showsExempt = weeks.some((week) => week.some((cell) => cell?.status === DAY_STATUS.EXEMPT));
  // Split so the legend only offers the swatches actually on screen, and never
  // labels a remote week as a plain non-working day.
  const nonWorkingCells = weeks
    .flat()
    .filter((cell) => cell?.status === DAY_STATUS.NON_WORKING)
    .map((cell) => nonWorkingKind(nonWorkingDays, format(cell.date, 'yyyy-MM-dd')));
  const showsRemote = nonWorkingCells.includes(REMOTE_KIND);
  const showsNonWorking = nonWorkingCells.some((kind) => kind !== REMOTE_KIND);

  return (
    <div className="app-panel p-4 md:p-5" data-test="attendance-calendar">
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

      <div className="grid grid-cols-7 gap-1">
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
            if (!cell) return <div key={`${wi}-${di}`} className="h-9" />;
            const { date, status } = cell;
            const dayKey = format(date, 'yyyy-MM-dd');
            const isRemote =
              status === DAY_STATUS.NON_WORKING &&
              nonWorkingKind(nonWorkingDays, dayKey) === REMOTE_KIND;
            const disabled =
              status === DAY_STATUS.WEEKEND ||
              status === DAY_STATUS.FUTURE ||
              status === DAY_STATUS.EXEMPT ||
              status === DAY_STATUS.NON_WORKING ||
              status === DAY_STATUS.BEFORE_START;
            return (
              <div
                key={`${wi}-${di}`}
                aria-disabled={disabled || undefined}
                className={cn(
                  'flex h-9 items-center justify-center rounded-md text-xs font-medium',
                  isRemote ? REMOTE_STYLE : STATUS_STYLES[status]
                )}
                title={`${format(date, 'EEE, MMM d')} — ${
                  status === DAY_STATUS.EXEMPT
                    ? 'on a project, attendance not required'
                    : status === DAY_STATUS.NON_WORKING
                      ? nonWorkingLabel(nonWorkingDays, dayKey) || 'not a working day'
                      : status === DAY_STATUS.BEFORE_START
                        ? 'before joining the programme'
                        : status.replace('-', ' ')
                }`}
                data-test={`attendance-day-${dayKey}`}
                data-status={status}
              >
                {format(date, 'd')}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3.5 border-t border-border/60 pt-3">
        <LegendItem dotClass={STATUS_DOT[DAY_STATUS.PRESENT]} label="Present" />
        <LegendItem dotClass={STATUS_DOT[DAY_STATUS.ABSENT]} label="Absent" />
        <LegendItem dotClass={STATUS_DOT[DAY_STATUS.TODAY_PENDING]} label="Today" />
        <LegendItem dotClass="bg-muted-foreground/30" label="Weekend" />
        {showsRemote && <LegendItem dotClass={STATUS_DOT[REMOTE_KIND]} label="Remote" />}
        {showsExempt && <LegendItem dotClass={STATUS_DOT[DAY_STATUS.EXEMPT]} label="On project" />}
        {showsNonWorking && <LegendItem dotClass="bg-muted-foreground/20" label="Non-working" />}
      </div>
    </div>
  );
}
