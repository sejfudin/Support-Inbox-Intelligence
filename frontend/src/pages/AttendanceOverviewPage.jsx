import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { addDays, format, isWeekend, parseISO, startOfMonth, subMonths } from 'date-fns';
import { Users, UserCheck, UserX, Percent, TriangleAlert, Star, House } from 'lucide-react';
import { PageShell, PageSection } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AttendanceStat from '@/components/attendance/AttendanceStat';
import AttendanceRosterTable from '@/components/attendance/AttendanceRosterTable';
import DailyAttendanceTable from '@/components/attendance/DailyAttendanceTable';
import InternAttendanceModal from '@/components/attendance/InternAttendanceModal';
import RemoteWorkQueue from '@/components/attendance/RemoteWorkQueue';
import { useAttendanceRoster } from '@/queries/attendance';
import { useRemoteWorkRequests } from '@/queries/remoteWork';
import { useHubs } from '@/queries/hubs';
import {
  attendanceRateTextClass,
  internStatusOnDate,
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

  // Shares its query key with RemoteWorkQueue's default fetch, so the two are one
  // request — this only exists so the tab can carry the count without mounting it.
  const { data: remoteWork } = useRemoteWorkRequests({ status: 'pending' });
  const remotePendingCount = remoteWork?.pendingCount ?? 0;

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

  // Counts for the selected day (present / remote / absent / not-yet). Remote is
  // tracked apart from present rather than folded in: both worked the day, but an
  // admin looking at a single day wants to know how many of them were in the
  // office. The "Working" tile below adds the two back together.
  const dayCounts = useMemo(() => {
    const date = parseISO(day);
    const acc = { present: 0, remote: 0, absent: 0, pending: 0 };
    roster.forEach((r) => {
      const { status } = internStatusOnDate(r, date, nonWorkingKeys);
      if (status === DAY_STATUS.PRESENT) acc.present += 1;
      else if (status === DAY_STATUS.REMOTE) acc.remote += 1;
      else if (status === DAY_STATUS.ABSENT) acc.absent += 1;
      else if (status === DAY_STATUS.TODAY_PENDING) acc.pending += 1;
    });
    return acc;
  }, [roster, day, nonWorkingKeys]);

  const dayIsToday = day === todayKey();

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          kicker="Future Experts Program"
          title="Attendance"
          // No longer wholly read-only: approving a remote-work request writes that
          // intern's attendance for the day. Check-ins are still theirs alone.
          subtitle="Office attendance across interns, by month. Only interns record their own check-ins — the one day you can record for them is an approved remote day."
        />

        {isError && (
          <div
            className="app-panel p-6 text-sm text-destructive"
            data-test="attendance-roster-error"
          >
            Failed to load attendance.
          </div>
        )}
        {isPending && (
          <div className="app-panel p-6 text-sm text-muted-foreground">Loading attendance…</div>
        )}

        {!isPending && !isError && (
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <TabsList data-test="attendance-tabs">
              <TabsTrigger value="month" data-test="attendance-tab-month">
                Month summary
              </TabsTrigger>
              <TabsTrigger value="day" data-test="attendance-tab-day">
                By day
              </TabsTrigger>
              <TabsTrigger value="remote" data-test="attendance-tab-remote">
                Remote work
                {/* The count is the whole point of surfacing it on the tab: a
                    request nobody notices goes stale on the day it was for. */}
                {remotePendingCount > 0 && (
                  <Badge variant="warning" className="ml-2">
                    {remotePendingCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Shared filters */}
            <div className="app-panel space-y-4 p-5 md:p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-test="attendance-search-input"
                />
                <Select value={hub || 'all'} onValueChange={(v) => setHub(v === 'all' ? '' : v)}>
                  <SelectTrigger data-test="attendance-hub-filter-select">
                    <SelectValue placeholder="All hubs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All hubs</SelectItem>
                    {hubNames.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger data-test="attendance-month-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="month" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AttendanceStat
                  label="Avg attendance"
                  value={`${monthSummary.avg}%`}
                  hint={monthLabel}
                  icon={Percent}
                  valueClassName={attendanceRateTextClass(monthSummary.avg)}
                />
                <AttendanceStat
                  label="Interns"
                  value={monthSummary.total}
                  hint="Total"
                  icon={Users}
                />
                <AttendanceStat
                  label="Perfect"
                  value={monthSummary.perfect}
                  hint={`100% in ${monthLabel}`}
                  icon={Star}
                  valueClassName={
                    monthSummary.perfect > 0 ? 'text-emerald-600 dark:text-emerald-400' : undefined
                  }
                />
                <AttendanceStat
                  label={`Below ${LOW_ATTENDANCE_THRESHOLD}%`}
                  value={monthSummary.low}
                  hint="Need attention"
                  icon={TriangleAlert}
                  valueClassName={
                    monthSummary.low > 0 ? 'text-amber-600 dark:text-amber-400' : undefined
                  }
                />
              </div>

              <AttendanceRosterTable
                roster={roster}
                rateLabel={`Attendance (${monthLabel})`}
                showToday={isCurrentMonth}
                onSelectIntern={setSelectedIntern}
              />
            </TabsContent>

            <TabsContent value="day" className="space-y-6">
              <div className="app-panel flex flex-wrap items-center gap-3 p-4 md:p-5">
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

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AttendanceStat
                  label="In the office"
                  value={`${dayCounts.present} / ${total}`}
                  hint={format(parseISO(day), 'EEE, MMM d')}
                  icon={UserCheck}
                  valueClassName="text-emerald-600 dark:text-emerald-400"
                />
                {dayCounts.remote > 0 && (
                  <AttendanceStat
                    label="Remote"
                    value={dayCounts.remote}
                    hint="Approved remote work"
                    icon={House}
                    valueClassName="text-fuchsia-600 dark:text-fuchsia-400"
                  />
                )}
                {dayIsToday && (
                  <AttendanceStat
                    label="Not yet in"
                    value={dayCounts.pending}
                    hint="Window may still be open"
                    icon={UserX}
                    valueClassName={
                      dayCounts.pending > 0 ? 'text-amber-600 dark:text-amber-400' : undefined
                    }
                  />
                )}
                <AttendanceStat
                  label="Absent"
                  value={dayCounts.absent}
                  hint={dayIsToday ? 'Window closed, no check-in' : 'Missed this day'}
                  icon={TriangleAlert}
                  valueClassName={
                    dayCounts.absent > 0 ? 'text-red-600 dark:text-red-400' : undefined
                  }
                />
                <AttendanceStat label="Interns" value={total} hint="Total" icon={Users} />
              </div>

              <DailyAttendanceTable
                roster={roster}
                date={day}
                onSelectIntern={setSelectedIntern}
                nonWorkingKeys={nonWorkingKeys}
              />
            </TabsContent>

            <TabsContent value="remote" className="space-y-6">
              <RemoteWorkQueue />
            </TabsContent>
          </Tabs>
        )}

        <InternAttendanceModal
          intern={selectedIntern}
          month={month}
          onClose={() => setSelectedIntern(null)}
        />
      </PageSection>
    </PageShell>
  );
}
