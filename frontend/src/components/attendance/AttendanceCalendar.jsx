import { useMemo, useState } from 'react';
import { addMonths, subMonths, isSameMonth, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildMonthGrid, DAY_STATUS } from '@/helpers/attendance';

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
};

const STATUS_DOT = {
  [DAY_STATUS.PRESENT]: 'bg-emerald-500',
  [DAY_STATUS.ABSENT]: 'bg-red-500',
  [DAY_STATUS.TODAY_PENDING]: 'bg-primary',
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
 * @param {{ records: Array<{date:string}>, cancelledDates?: string[] }} props
 */
export default function AttendanceCalendar({ records = [], cancelledDates = [] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const { weeks, monthLabel } = useMemo(
    () => buildMonthGrid(cursor, records, cancelledDates),
    [cursor, records, cancelledDates]
  );
  const atCurrentMonth = isSameMonth(cursor, new Date());

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
            const disabled = status === DAY_STATUS.WEEKEND || status === DAY_STATUS.FUTURE;
            return (
              <div
                key={`${wi}-${di}`}
                aria-disabled={disabled || undefined}
                className={cn(
                  'flex h-9 items-center justify-center rounded-md text-xs font-medium',
                  STATUS_STYLES[status]
                )}
                title={`${format(date, 'EEE, MMM d')} — ${status.replace('-', ' ')}`}
                data-test={`attendance-day-${format(date, 'yyyy-MM-dd')}`}
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
      </div>
    </div>
  );
}
