import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { Users, UserCheck, UserX, Percent, TriangleAlert } from 'lucide-react';
import { PageShell, PageSection } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import StatBandSkeleton from '@/components/Skeletons/StatBandSkeleton';
import AttendanceStat from '@/components/attendance/AttendanceStat';
import TodayStandupCard from '@/components/dailies/TodayStandupCard';
import DailyCoverageGrid from '@/components/dailies/DailyCoverageGrid';
import MemberDailyEntryModal from '@/components/dailies/MemberDailyEntryModal';
import { useAllWorkspaces } from '@/queries/workspaces';
import { useWorkspaceDailyOverview } from '@/queries/dailies';
import { useAuth } from '@/context/AuthContext';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

const currentMonthKey = () => format(new Date(), 'yyyy-MM');

// Standups are only tracked going forward from when the feature shipped, so —
// same as Attendance's month picker — the last 6 months is plenty of range.
const buildMonthOptions = () => {
  const base = startOfMonth(new Date());
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(base, i);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
  });
};

export default function AdminDailyInsightsPage() {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState('');
  const [month, setMonth] = useState(() => currentMonthKey());
  const [selection, setSelection] = useState(null);
  const [rangeOption, setRangeOption] = useState('full');

  const { data: workspaces = [] } = useAllWorkspaces();

  // Which workspace to land on, in order of preference:
  //   1. `?workspace=` — arriving from somewhere that already had one in mind, e.g.
  //      the dashboard's "Open standup board", which must not silently switch the
  //      admin to a different workspace than the board they were just reading.
  //   2. the caller's own active workspace (the one named in the sidebar).
  //   3. the first in the list, as a last resort.
  // Any existing valid selection wins over all of it, so changing the dropdown
  // sticks instead of being reset on the next render.
  useEffect(() => {
    if (workspaces.length === 0) return;
    if (workspaces.some((w) => w._id === workspaceId)) return;

    const exists = (id) => id && workspaces.some((w) => w._id === id);
    const requested = searchParams.get('workspace');

    if (exists(requested)) setWorkspaceId(requested);
    else if (exists(user?.workspaceId)) setWorkspaceId(user.workspaceId);
    else setWorkspaceId(workspaces[0]._id);
  }, [workspaces, workspaceId, searchParams, user?.workspaceId]);

  const { data, isPending: isPendingRaw, isError } = useWorkspaceDailyOverview(workspaceId, month);
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });
  const overview = data?.data;
  const isCurrentMonth = month === currentMonthKey();
  // Weekend has no standup expectation — don't surface "reported/not reported today"
  // (or "open blockers today") KPIs that would mark everyone as missing.
  const showTodayStats = isCurrentMonth && !overview?.today?.isWeekend;
  const monthLabel = format(parseISO(`${month}-01`), 'MMMM yyyy');

  const monthMissed = useMemo(
    () =>
      (overview?.coverage?.people ?? []).reduce(
        (sum, p) => sum + (p.eligibleWorkingDays - p.reportedCount),
        0
      ),
    [overview]
  );

  const showContent = workspaceId && !isPending && !isError && overview;

  // Drop a stale popup target when the report context changes.
  useEffect(() => {
    setSelection(null);
  }, [workspaceId, month]);

  return (
    <PageShell>
      <PageSection className="space-y-5">
        <PageHeading
          crumb="Admin"
          title="Daily Standup Insights"
          subtitle="Who reported today, and how a workspace's standup coverage looks over the month."
          titleAdornment={<Badge variant="outline">Read-only</Badge>}
        />

        <div className="app-card flex flex-wrap gap-3 p-4">
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger
              className="w-full sm:w-[280px]"
              data-test="daily-insights-workspace-select"
            >
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem
                  key={ws._id}
                  value={ws._id}
                  data-test={`daily-insights-workspace-option-${ws._id}`}
                >
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full sm:w-[200px]" data-test="daily-insights-month-select">
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

        {!workspaceId && (
          <div className="app-card p-6 text-sm text-muted-foreground">
            No workspaces to show yet.
          </div>
        )}

        {workspaceId && isError && (
          <div
            className="app-card p-6 text-sm text-[hsl(var(--tone-danger-fg))]"
            data-test="daily-insights-error"
          >
            Failed to load daily insights.
          </div>
        )}
        {/* The bands are known before the numbers are: the standup card only exists on the
            current month, then the KPI strip, then the coverage grid. The one thing the page
            can't know yet is whether today is a weekend — the server decides that, and on a
            weekend the two "today" tiles don't render — so a Saturday drops two placeholders
            when the data lands. Every other day the strip is exactly what arrives. */}
        {workspaceId && isPending && (
          <LoadingOverlay label="Loading daily insights" contentClassName="space-y-3">
            {isCurrentMonth && <Skeleton className="h-[168px] w-full rounded-[var(--r-card)]" />}
            <StatBandSkeleton
              tiles={isCurrentMonth ? 4 : 2}
              columnsClassName="sm:grid-cols-2 lg:grid-cols-4"
            />
            <Skeleton className="h-[320px] w-full rounded-[var(--r-card)]" />
          </LoadingOverlay>
        )}

        {showContent && (
          <>
            {isCurrentMonth && <TodayStandupCard today={overview.today} onSelect={setSelection} />}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {showTodayStats && (
                <>
                  <AttendanceStat
                    label="Reported today"
                    value={`${overview.stats.reportedToday}/${overview.stats.totalInterns}`}
                    hint="Members"
                    icon={UserCheck}
                    valueClassName="text-[hsl(var(--tone-success-fg))]"
                  />
                  <AttendanceStat
                    label="Not reported today"
                    value={overview.stats.notReportedToday}
                    hint={overview.stats.notReportedToday > 0 ? 'Needs a nudge' : 'All clear'}
                    icon={UserX}
                    valueClassName={
                      overview.stats.notReportedToday > 0
                        ? 'text-[hsl(var(--tone-danger-fg))]'
                        : undefined
                    }
                  />
                </>
              )}
              <AttendanceStat
                label="Coverage this month"
                value={`${overview.stats.coverageRate}%`}
                hint={monthLabel}
                icon={Percent}
              />
              {showTodayStats ? (
                <AttendanceStat
                  label="Open blockers"
                  value={overview.stats.openBlockers}
                  hint="Today"
                  icon={TriangleAlert}
                  valueClassName={
                    overview.stats.openBlockers > 0
                      ? 'text-[hsl(var(--tone-warning-fg))]'
                      : undefined
                  }
                />
              ) : (
                <AttendanceStat
                  label="Missed this month"
                  value={monthMissed}
                  hint={monthLabel}
                  icon={Users}
                  valueClassName={monthMissed > 0 ? 'text-[hsl(var(--tone-danger-fg))]' : undefined}
                />
              )}
            </div>
            <DailyCoverageGrid
              coverage={overview.coverage}
              onSelectCell={setSelection}
              rangeOption={rangeOption}
              onRangeChange={setRangeOption}
            />
          </>
        )}

        <MemberDailyEntryModal
          workspaceId={workspaceId}
          selection={selection}
          onClose={() => setSelection(null)}
        />
      </PageSection>
    </PageShell>
  );
}
