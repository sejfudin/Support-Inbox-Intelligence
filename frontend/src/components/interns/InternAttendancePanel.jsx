import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { dayStatusClass } from '@/components/attendance/dayStatusVisuals';
import {
  DAY_STATUS,
  classifyDay,
  attendanceRateTextClass,
  formatAttendanceRate,
  isLeaveStatus,
  nonWorkingKeySet,
  officeDateKey,
  stripAttendance,
} from '@/helpers/attendance';
import { useInternAttendance } from '@/queries/attendance';
import { cn } from '@/lib/utils';
import { Loader, useLoaderHold } from '@/components/ui/loader';

const HEATMAP_MONTHS = 6;

const STATUS_LABEL = {
  [DAY_STATUS.PRESENT]: 'Present',
  [DAY_STATUS.REMOTE]: 'Remote work',
  [DAY_STATUS.VACATION]: 'Vacation',
  [DAY_STATUS.RELIGIOUS]: 'Religious holiday',
  [DAY_STATUS.SICK]: 'Sick day',
  [DAY_STATUS.ABSENT]: 'Absent',
  [DAY_STATUS.TODAY_PENDING]: 'Not checked in yet',
  [DAY_STATUS.NON_WORKING]: 'Non-working day',
  [DAY_STATUS.EXEMPT]: 'On project',
  [DAY_STATUS.WEEKEND]: 'Weekend',
  [DAY_STATUS.FUTURE]: '—',
  [DAY_STATUS.BEFORE_START]: 'Before start',
};

function Stat({ label, value, hint, valueClassName }) {
  return (
    <div className="app-card flex flex-col gap-1 px-[15px] py-[13px]">
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className={cn('app-stat-value', valueClassName)}>{value}</span>
      {hint ? <span className="text-[11px] text-muted-foreground/75">{hint}</span> : null}
    </div>
  );
}

// The heatmap legend, in the order `LEAVE_STATUSES` and the mockup both list them:
// what you did, what you missed, what was excused, what was never owed.
const LEGEND = [
  { status: DAY_STATUS.PRESENT, label: 'Present' },
  { status: DAY_STATUS.ABSENT, label: 'Absent' },
  { status: DAY_STATUS.VACATION, label: 'Approved away' },
  { status: DAY_STATUS.NON_WORKING, label: 'Not required' },
];

/**
 * Attendance for one intern, read-only: the month's stats, six months of days as
 * a strip per month, every approved absence, and the check-ins behind them.
 *
 * Admin-only by necessity, not by choice — `GET /attendance/:internProfileId` is
 * `requireRole(ADMIN)`, and the overhaul adds no server surface. `InternProfileView`
 * hides the tab for everyone else rather than rendering a guaranteed 403.
 */
export default function InternAttendancePanel({ internProfileId }) {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const monthKey = format(monthDate, 'yyyy-MM');
  const { data, isPending: isPendingRaw, isError } = useInternAttendance(internProfileId, monthKey);
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });

  const presentKeys = useMemo(
    () => new Set((data?.records || []).map((record) => record.date)),
    [data?.records]
  );
  const cancelledKeys = useMemo(() => new Set(data?.cancelledDates || []), [data?.cancelledDates]);
  const nonWorkingKeys = useMemo(
    () => nonWorkingKeySet(data?.nonWorkingDays || []),
    [data?.nonWorkingDays]
  );

  const classify = useMemo(() => {
    const requestedDays = data?.requestedDays || {};
    return (date) =>
      classifyDay(
        date,
        presentKeys,
        cancelledKeys,
        new Date(),
        data?.placedAt || null,
        nonWorkingKeys,
        data?.startDate || null,
        requestedDays
      );
  }, [
    presentKeys,
    cancelledKeys,
    nonWorkingKeys,
    data?.placedAt,
    data?.startDate,
    data?.requestedDays,
  ]);

  // Six month strips, oldest first, each one every day of that month in a row.
  const strips = useMemo(() => {
    const end = startOfMonth(new Date());
    return Array.from({ length: HEATMAP_MONTHS }, (_, index) => {
      const month = subMonths(end, HEATMAP_MONTHS - 1 - index);
      const days = eachDayOfInterval({ start: month, end: endOfMonth(month) }).map((date) => ({
        date,
        key: officeDateKey(date),
        status: classify(date),
      }));
      // Per-month rate through `stripAttendance` rather than counted here, so the
      // number beside the strip is derived by the same rule as the month stat above
      // it and the server's own percentage.
      const { present, elapsed } = stripAttendance(days);
      return {
        key: format(month, 'yyyy-MM'),
        label: format(month, 'MMMM'),
        days,
        rate: elapsed > 0 ? Math.round((present / elapsed) * 100) : null,
      };
    });
  }, [classify]);

  // Consecutive days of the same leave type collapse into one entry — five sick
  // days in a row is one absence to a reader, not five rows.
  const timeAway = useMemo(() => {
    const entries = Object.entries(data?.requestedDays || {})
      .filter(([, status]) => status !== 'remote')
      .sort(([a], [b]) => (a < b ? -1 : 1));

    const runs = [];
    for (const [dateKey, status] of entries) {
      const previous = runs[runs.length - 1];
      const isNext =
        previous &&
        previous.status === status &&
        (new Date(dateKey) - new Date(previous.to)) / 86400000 <= 3;
      if (isNext) previous.to = dateKey;
      else runs.push({ status, from: dateKey, to: dateKey });
    }
    return runs.reverse();
  }, [data?.requestedDays]);

  const monthCheckIns = useMemo(
    () =>
      (data?.records || [])
        .filter((record) => record.date.startsWith(monthKey))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data?.records, monthKey]
  );

  if (isPending) {
    return (
      <div className="app-card p-6">
        <Loader size="sm" label="Loading attendance…" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="app-card p-6 text-[12.5px] text-[hsl(var(--tone-danger-fg))]">
        Unable to load this intern&apos;s attendance.
      </div>
    );
  }

  const stats = data.month || {};
  const awayDays = Object.values(data.requestedDays || {}).filter(
    (status) => status !== 'remote'
  ).length;

  return (
    <div className="space-y-3.5" data-test="intern-attendance-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-[var(--r-control)]"
            aria-label="Previous month"
            onClick={() => setMonthDate((current) => subMonths(current, 1))}
            data-test="intern-attendance-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[8.5rem] text-center text-[13px] font-semibold text-foreground">
            {format(monthDate, 'MMMM yyyy')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-[var(--r-control)]"
            aria-label="Next month"
            disabled={monthKey >= format(new Date(), 'yyyy-MM')}
            onClick={() => setMonthDate((current) => addMonths(current, 1))}
            data-test="intern-attendance-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-[11.5px] text-muted-foreground">
          Read-only — only the intern can record a check-in.
        </span>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Attendance rate"
          value={formatAttendanceRate(stats.attendanceRate) || '—'}
          hint={format(monthDate, 'MMMM yyyy')}
          // The one coloured number on the tab: the rate is the figure a reader
          // came for, and the tone says whether it needs attention before they
          // finish reading the digits.
          valueClassName={attendanceRateTextClass(stats.attendanceRate)}
        />
        <Stat label="Days present" value={stats.presentDays ?? 0} hint="Office and remote" />
        <Stat label="Days owed" value={stats.workingDays ?? 0} hint="Excludes leave and holidays" />
        <Stat label="Time away" value={awayDays} hint="Approved days, all time" />
      </div>

      {/* Heatmap beside the absences it explains, rather than stacked above them:
          a run of red in April and the approved leave that accounts for it are one
          question, and the reader shouldn't have to scroll between the halves. */}
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="app-card px-4 pb-4 pt-3.5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="app-card-title">Last six months</span>
            <span className="text-[11.5px] text-muted-foreground/75">Working days only</span>
          </div>
          <div className="app-table-scroll">
            <div className="min-w-[30rem] space-y-2.5">
              {strips.map((strip) => (
                <div
                  key={strip.key}
                  className="grid grid-cols-[78px_minmax(0,1fr)_44px] items-center gap-3"
                >
                  <span className="truncate text-[12px] text-muted-foreground">{strip.label}</span>
                  <div className="flex gap-[3px]">
                    {strip.days.map((day) => (
                      <span
                        key={day.key}
                        title={`${format(day.date, 'EEE, MMM d')} — ${STATUS_LABEL[day.status] || day.status}`}
                        className={cn(
                          'h-[18px] flex-1 rounded-[3px] border',
                          dayStatusClass(day.status)
                        )}
                      />
                    ))}
                  </div>
                  <span
                    className={cn(
                      'text-right text-[12.5px] font-semibold',
                      attendanceRateTextClass(strip.rate)
                    )}
                  >
                    {formatAttendanceRate(strip.rate)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* The strip is four colours with no key otherwise — and "grey" reading as
              either a weekend or an approved absence is the one thing a reader
              cannot guess. */}
          <div className="mt-3.5 flex flex-wrap gap-3.5 border-t border-separator pt-3">
            {LEGEND.map((item) => (
              <span
                key={item.status}
                className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"
              >
                <span
                  className={cn('h-2.5 w-2.5 rounded-[3px] border', dayStatusClass(item.status))}
                  aria-hidden
                />
                {item.label}
              </span>
            ))}
          </div>
        </section>

        <section className="app-card overflow-hidden">
          <header className="app-card-head">
            <span className="app-card-title">Time away</span>
          </header>
          <div className="px-[18px]">
            {timeAway.length === 0 ? (
              <p className="py-[13px] text-[12.5px] text-muted-foreground">
                No approved absences on record.
              </p>
            ) : (
              timeAway.map((entry) => (
                <div
                  key={`${entry.status}-${entry.from}`}
                  className="flex items-center justify-between gap-3 border-b border-separator py-[13px] last:border-b-0"
                >
                  <span className="flex min-w-0 flex-col gap-0.5 leading-[1.35]">
                    <span className="text-[12.5px] font-medium text-foreground">
                      {STATUS_LABEL[entry.status] || entry.status}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground/75">
                      {entry.from === entry.to
                        ? format(new Date(entry.from), 'MMM d, yyyy')
                        : `${format(new Date(entry.from), 'MMM d')} – ${format(new Date(entry.to), 'MMM d, yyyy')}`}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'app-chip border',
                      dayStatusClass(isLeaveStatus(entry.status) ? entry.status : DAY_STATUS.REMOTE)
                    )}
                  >
                    Approved
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Full width, below the pair: it is the row-per-day evidence behind both
          cards above, and the mockup gives it the whole column. */}
      <section className="app-card overflow-hidden">
        <header className="app-card-head">
          <span className="app-card-title">Check-ins in {format(monthDate, 'MMMM')}</span>
        </header>
        <div className="app-table-scroll">
          <table className="w-full min-w-[30rem] border-collapse text-left">
            <thead>
              <tr className="app-table-head">
                <th className="w-[130px] px-[18px] font-semibold">Date</th>
                <th className="w-[110px] px-3 font-semibold">Day</th>
                <th className="w-[110px] px-3 font-semibold">Check-in</th>
                <th className="px-[18px] font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {monthCheckIns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-[18px] py-5 text-[12.5px] text-muted-foreground">
                    No check-ins this month.
                  </td>
                </tr>
              ) : (
                monthCheckIns.map((record) => {
                  const date = new Date(record.date);
                  const status = classify(date);
                  return (
                    <tr
                      key={record.date}
                      className="border-t border-separator transition-colors hover:bg-accent/60"
                    >
                      <td className="px-[18px] py-2.5 text-[12.5px] font-medium text-foreground">
                        {format(date, 'MMM d')}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-muted-foreground">
                        {format(date, 'EEEE')}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-muted-foreground">
                        {record.checkedInAt ? format(new Date(record.checkedInAt), 'HH:mm') : '—'}
                      </td>
                      <td className="px-[18px] py-2.5">
                        <span className={cn('app-chip border', dayStatusClass(status))}>
                          <CalendarCheck className="h-3 w-3" aria-hidden />
                          {STATUS_LABEL[status] || status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
