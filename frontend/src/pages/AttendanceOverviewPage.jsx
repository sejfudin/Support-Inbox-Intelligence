import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { addDays, format, isWeekend, parseISO, startOfMonth, subMonths } from 'date-fns';
import PageHeading from '@/components/PageHeading';
import FilterSelect from '@/components/FilterSelect';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchField } from '@/components/ui/search-field';
import { Switcher } from '@/components/ui/switcher';
import { AnalyticsStatCard } from '@/components/analytics/AnalyticsStatCard';
import AttendanceRosterTable from '@/components/attendance/AttendanceRosterTable';
import DailyAttendanceTable from '@/components/attendance/DailyAttendanceTable';
import InternAttendanceModal from '@/components/attendance/InternAttendanceModal';
import { useAttendanceRoster } from '@/queries/attendance';
import { useHubs } from '@/queries/hubs';
import {
  attendanceRateTextClass,
  internStatusOnDate,
  isLeaveStatus,
  nonWorkingKeySet,
  DAY_STATUS,
} from '@/helpers/attendance';

const LOW_ATTENDANCE_THRESHOLD = 75;
const todayKey = () => format(new Date(), 'yyyy-MM-dd');
const currentMonthKey = () => format(new Date(), 'yyyy-MM');

// Attendance is tracked per calendar month; the last few months are selectable.
const buildMonthOptions = () => {
  const base = startOfMonth(new Date());
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(base, i);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
  });
};

// First weekday (Mon–Fri) of a 'yyyy-MM' month, as a 'yyyy-MM-dd' key.
const firstWeekdayOf = (monthKey) => {
  let d = parseISO(`${monthKey}-01`);
  while (isWeekend(d)) d = addDays(d, 1);
  return format(d, 'yyyy-MM-dd');
};

// A sensible default day inside a month: today if it's the current month,
// otherwise the month's first weekday.
const defaultDayForMonth = (monthKey) =>
  monthKey === currentMonthKey() ? todayKey() : firstWeekdayOf(monthKey);

// Aggregate a set of attendance rates into headline summary numbers.
const summarize = (rates, total) => {
  if (total === 0) return { avg: 0, low: 0, perfect: 0 };
  const avg = Math.round(rates.reduce((s, r) => s + r, 0) / total);
  const low = rates.filter((r) => r < LOW_ATTENDANCE_THRESHOLD).length;
  const perfect = rates.filter((r) => r === 100).length;
  return { avg, low, perfect };
};

export default function AttendanceOverviewPage() {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [tab, setTab] = useState('month');
  const [search, setSearch] = useState('');
  const [hub, setHub] = useState('');
  const [month, setMonth] = useState(() => currentMonthKey());
  const [day, setDay] = useState(() => todayKey());
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [debouncedSearch] = useDebounce(search, 400);

  // Keep the selected day inside the selected month.
  useEffect(() => {
    if (format(parseISO(day), 'yyyy-MM') !== month) setDay(defaultDayForMonth(month));
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isPending, isError } = useAttendanceRoster({
    month,
    search: debouncedSearch || undefined,
    hub: hub || undefined,
  });

  const { data: hubs = [] } = useHubs();
  const hubNames = hubs.map((h) => h.name);

  const roster = data?.roster ?? [];
  const nonWorkingKeys = useMemo(() => nonWorkingKeySet(data?.nonWorkingDays), [data]);
  const total = roster.length;
  const isCurrentMonth = month === currentMonthKey();
  const monthLabel = format(parseISO(`${month}-01`), 'MMMM yyyy');

  // Month summary from the server's month-scoped rates. Interns who owed nothing
  // that month (on a project) report a null rate and are left out entirely — folding
  // them in as 0% would drag the cohort average down for days nobody was expected in.
  const monthSummary = useMemo(() => {
    const rates = roster.map((r) => r.attendanceRate).filter((rate) => typeof rate === 'number');
    return { ...summarize(rates, rates.length), total };
  }, [roster, total]);

  // Counts for the selected day (present / remote / away / absent / not-yet).
  //
  // Remote is tracked apart from present rather than folded in: both worked the
  // day, but an admin looking at a single day wants to know how many of them were
  // in the office. `away` is the three approved-leave types together — they owed
  // nothing, so they belong in neither the worked count nor the absent one, and
  // lumping them into "absent" would invent a problem the admin already signed off.
  const dayCounts = useMemo(() => {
    const date = parseISO(day);
    const acc = { present: 0, remote: 0, away: 0, absent: 0, pending: 0 };
    roster.forEach((r) => {
      const { status } = internStatusOnDate(r, date, nonWorkingKeys);
      if (status === DAY_STATUS.PRESENT) acc.present += 1;
      else if (status === DAY_STATUS.REMOTE) acc.remote += 1;
      else if (isLeaveStatus(status)) acc.away += 1;
      else if (status === DAY_STATUS.ABSENT) acc.absent += 1;
      else if (status === DAY_STATUS.TODAY_PENDING) acc.pending += 1;
    });
    return acc;
  }, [roster, day, nonWorkingKeys]);

  const dayIsToday = day === todayKey();

  return (
    <div className="app-page">
      <div className="app-page-content pb-0">
        <PageHeading
          crumb="Admin"
          title="Attendance"
          // No longer wholly read-only: approving a remote-work request writes that
          // intern's attendance for the day. Check-ins are still theirs alone.
          subtitle="Office attendance across interns, by month. Only interns record their own check-ins — the one day you can record for them is an approved remote day."
        />

        <div>
          {/* Month summary / By day is a switcher, not tabs: it is the same
              roster for the same month, drawn two ways. The page does not become
              a different page, so it does not get a tab strip — it used to have
              one, and that is why this control, the Tickets list/board toggle and
              the requests tabs all looked like three different products.

              The band bleeds the page gutter so its surface spans the full
              column, then pads it back so the switcher lines up with the card
              edges below. The filters ride on its right because they apply to
              both views — in a card of their own they cost a row of height to say
              nothing. Rendered outside the loading branch so the controls do not
              appear only once the roster lands. */}
          <div className="-mx-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-separator bg-card px-6 py-2">
            <Switcher
              items={[
                { value: 'month', label: 'Month summary', dataTest: 'attendance-tab-month' },
                { value: 'day', label: 'By day', dataTest: 'attendance-tab-day' },
              ]}
              value={tab}
              onChange={setTab}
              label="Attendance view"
              data-test="attendance-tabs"
            />

            {/* One row, one height: a 32px search beside two 32px dropdowns. */}
            <div className="flex flex-wrap items-center gap-[var(--control-gap)]">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Search interns…"
                aria-label="Search interns"
                className="w-full sm:w-[230px]"
                data-test="attendance-search-input"
              />
              <FilterSelect
                value={hub}
                onChange={(v) => setHub(v === 'all' ? '' : v)}
                options={hubNames.map((h) => ({ value: h, label: h }))}
                allLabel="All hubs"
                dataTest="attendance-hub-filter-select"
                className="w-[150px]"
              />
              <FilterSelect
                value={month}
                onChange={setMonth}
                options={monthOptions}
                // The month always has a value, so "a value is set" would light
                // this up permanently — it is only *filtering* away from the
                // current month.
                active={month !== currentMonthKey()}
                dataTest="attendance-month-select"
                className="w-[165px]"
              />
            </div>
          </div>

          <div className="space-y-3.5 py-[18px]">
            {isError && (
              <div
                className="app-card p-6 text-[12.5px] text-[hsl(var(--tone-danger-fg))]"
                data-test="attendance-roster-error"
              >
                Failed to load attendance.
              </div>
            )}
            {isPending && (
              <div className="app-card p-6 text-[12.5px] text-muted-foreground">
                Loading attendance…
              </div>
            )}

            {!isPending && !isError && (
              <>
                <div className={tab === 'month' ? 'space-y-3.5' : 'hidden'}>
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <AnalyticsStatCard
                      label="Avg attendance"
                      value={`${monthSummary.avg}%`}
                      hint={monthLabel}
                      valueClassName={attendanceRateTextClass(monthSummary.avg)}
                    />
                    <AnalyticsStatCard label="Interns" value={monthSummary.total} hint="Total" />
                    <AnalyticsStatCard
                      label="Perfect"
                      value={monthSummary.perfect}
                      hint={`100% in ${monthLabel}`}
                      tone={monthSummary.perfect > 0 ? 'positive' : 'default'}
                    />
                    <AnalyticsStatCard
                      label={`Below ${LOW_ATTENDANCE_THRESHOLD}%`}
                      value={monthSummary.low}
                      hint="Need attention"
                      valueClassName={
                        monthSummary.low > 0 ? 'text-[hsl(var(--tone-warning-fg))]' : undefined
                      }
                    />
                  </div>

                  <AttendanceRosterTable
                    roster={roster}
                    rateLabel={`Attendance (${format(parseISO(`${month}-01`), 'MMM')})`}
                    showToday={isCurrentMonth}
                    nonWorkingKeys={nonWorkingKeys}
                    onSelectIntern={setSelectedIntern}
                  />
                </div>

                <div className={tab === 'day' ? 'space-y-3.5' : 'hidden'}>
                  <div className="app-card flex flex-wrap items-center gap-3 p-4 md:p-5">
                    <span className="text-sm font-medium text-muted-foreground">
                      Day in {monthLabel}:
                    </span>
                    <DatePicker
                      value={day}
                      onChange={setDay}
                      isDateDisabled={(d) => isWeekend(d) || format(d, 'yyyy-MM') !== month}
                      data-test="attendance-day-picker"
                    />
                    {isCurrentMonth && !dayIsToday && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDay(todayKey())}
                        data-test="attendance-day-today-button"
                      >
                        Today
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <AnalyticsStatCard
                      label="In the office"
                      value={`${dayCounts.present} / ${total}`}
                      hint={format(parseISO(day), 'EEE, MMM d')}
                      tone="positive"
                    />
                    {dayCounts.remote > 0 && (
                      <AnalyticsStatCard
                        label="Remote"
                        value={dayCounts.remote}
                        hint="Approved remote work"
                        valueClassName="text-[hsl(var(--tone-cyan-fg))]"
                      />
                    )}
                    {dayCounts.away > 0 && (
                      <AnalyticsStatCard
                        label="Away"
                        value={dayCounts.away}
                        hint="Approved leave — not owed"
                        valueClassName="text-[hsl(var(--tone-info-fg))]"
                      />
                    )}
                    {dayIsToday && (
                      <AnalyticsStatCard
                        label="Not yet in"
                        value={dayCounts.pending}
                        hint="Window may still be open"
                        valueClassName={
                          dayCounts.pending > 0 ? 'text-[hsl(var(--tone-warning-fg))]' : undefined
                        }
                      />
                    )}
                    <AnalyticsStatCard
                      label="Absent"
                      value={dayCounts.absent}
                      hint={dayIsToday ? 'Window closed, no check-in' : 'Missed this day'}
                      tone={dayCounts.absent > 0 ? 'negative' : 'default'}
                    />
                    <AnalyticsStatCard label="Interns" value={total} hint="Total" />
                  </div>

                  <DailyAttendanceTable
                    roster={roster}
                    date={day}
                    onSelectIntern={setSelectedIntern}
                    nonWorkingKeys={nonWorkingKeys}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <InternAttendanceModal
          intern={selectedIntern}
          month={month}
          onClose={() => setSelectedIntern(null)}
        />
      </div>
    </div>
  );
}
