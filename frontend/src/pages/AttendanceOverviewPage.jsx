import { useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { format, isToday, isWeekend, parseISO } from 'date-fns';
import { Users, UserCheck, UserX, Percent, TriangleAlert, Star } from 'lucide-react';
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
import { useAttendanceRoster } from '@/queries/attendance';
import { useHubs } from '@/queries/hubs';
import {
  isCheckedInToday,
  attendanceRateTextClass,
  currentMonthAttendance,
  internStatusOnDate,
  DAY_STATUS,
} from '@/helpers/attendance';

const LOW_ATTENDANCE_THRESHOLD = 75;
const todayKey = () => format(new Date(), 'yyyy-MM-dd');

// Aggregate a set of attendance rates into headline summary numbers.
const summarize = (rates, total) => {
  if (total === 0) return { avg: 0, low: 0, perfect: 0 };
  const avg = Math.round(rates.reduce((s, r) => s + r, 0) / total);
  const low = rates.filter((r) => r < LOW_ATTENDANCE_THRESHOLD).length;
  const perfect = rates.filter((r) => r === 100).length;
  return { avg, low, perfect };
};

export default function AttendanceOverviewPage() {
  const [tab, setTab] = useState('today');
  const [search, setSearch] = useState('');
  const [hub, setHub] = useState('');
  const [day, setDay] = useState(() => todayKey());
  const [debouncedSearch] = useDebounce(search, 400);

  const { data, isPending, isError } = useAttendanceRoster({
    search: debouncedSearch || undefined,
    hub: hub || undefined,
  });

  const { data: hubs = [] } = useHubs();
  const hubNames = hubs.map((h) => h.name);

  const roster = data?.roster ?? [];
  const total = roster.length;

  // Current-month summary (elapsed working days), same basis as intern page.
  const monthSummary = useMemo(() => {
    const rates = roster.map((r) => currentMonthAttendance(r.records).rate);
    const inToday = roster.filter((r) => isCheckedInToday(r.records)).length;
    return { ...summarize(rates, total), inToday, absentToday: total - inToday, total };
  }, [roster, total]);

  // All-time summary from the roster's stored totals.
  const overallSummary = useMemo(() => {
    const rates = roster.map((r) => r.attendanceRate ?? 0);
    return { ...summarize(rates, total), total };
  }, [roster, total]);

  // Counts for the selected day in the "Today" tab (present / absent / not-yet).
  const dayCounts = useMemo(() => {
    const date = parseISO(day);
    const acc = { present: 0, absent: 0, pending: 0 };
    roster.forEach((r) => {
      const { status } = internStatusOnDate(r, date);
      if (status === DAY_STATUS.PRESENT) acc.present += 1;
      else if (status === DAY_STATUS.ABSENT) acc.absent += 1;
      else if (status === DAY_STATUS.TODAY_PENDING) acc.pending += 1;
    });
    return acc;
  }, [roster, day]);

  const dayIsToday = isToday(parseISO(day));

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          kicker="Future Experts Program"
          title="Attendance"
          subtitle="Office attendance across interns. This view is read-only — only interns can record their own check-ins."
          titleAdornment={<Badge variant="outline">Read-only</Badge>}
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
              <TabsTrigger value="today" data-test="attendance-tab-today">
                Today
              </TabsTrigger>
              <TabsTrigger value="month" data-test="attendance-tab-month">
                This month
              </TabsTrigger>
              <TabsTrigger value="overall" data-test="attendance-tab-overall">
                Overall
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
                {tab === 'today' && (
                  <div className="flex items-center gap-2">
                    <DatePicker
                      value={day}
                      onChange={setDay}
                      className="flex-1"
                      isDateDisabled={isWeekend}
                      data-test="attendance-day-picker"
                    />
                    {!dayIsToday && (
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
                )}
              </div>
            </div>

            <TabsContent value="today" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AttendanceStat
                  label="Present"
                  value={`${dayCounts.present} / ${total}`}
                  hint={format(parseISO(day), 'EEE, MMM d')}
                  icon={UserCheck}
                  valueClassName="text-emerald-600 dark:text-emerald-400"
                />
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

              <DailyAttendanceTable roster={roster} date={day} />
            </TabsContent>

            <TabsContent value="month" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AttendanceStat
                  label="Avg attendance"
                  value={`${monthSummary.avg}%`}
                  hint="This month"
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
                  hint="100% this month"
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

              <AttendanceRosterTable roster={roster} basis="month" />
            </TabsContent>

            <TabsContent value="overall" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AttendanceStat
                  label="Avg attendance"
                  value={`${overallSummary.avg}%`}
                  hint="Whole internship"
                  icon={Percent}
                  valueClassName={attendanceRateTextClass(overallSummary.avg)}
                />
                <AttendanceStat
                  label="Interns"
                  value={overallSummary.total}
                  hint="Total"
                  icon={Users}
                />
                <AttendanceStat
                  label="Perfect"
                  value={overallSummary.perfect}
                  hint="100% all time"
                  icon={Star}
                  valueClassName={
                    overallSummary.perfect > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : undefined
                  }
                />
                <AttendanceStat
                  label={`Below ${LOW_ATTENDANCE_THRESHOLD}%`}
                  value={overallSummary.low}
                  hint="Need attention"
                  icon={TriangleAlert}
                  valueClassName={
                    overallSummary.low > 0 ? 'text-amber-600 dark:text-amber-400' : undefined
                  }
                />
              </div>

              <AttendanceRosterTable roster={roster} basis="overall" />
            </TabsContent>
          </Tabs>
        )}
      </PageSection>
    </PageShell>
  );
}
