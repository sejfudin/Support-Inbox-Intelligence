import { useEffect, useMemo, useState } from 'react';
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
import AttendanceStat from '@/components/attendance/AttendanceStat';
import TodayStandupCard from '@/components/dailies/TodayStandupCard';
import DailyCoverageGrid from '@/components/dailies/DailyCoverageGrid';
import MemberDailyEntryModal from '@/components/dailies/MemberDailyEntryModal';
import { useAllWorkspaces } from '@/queries/workspaces';
import { useWorkspaceDailyOverview } from '@/queries/dailies';

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
  const [workspaceId, setWorkspaceId] = useState('');
  const [month, setMonth] = useState(() => currentMonthKey());
  const [selection, setSelection] = useState(null);
  const [rangeOption, setRangeOption] = useState('full');

  const { data: workspaces = [] } = useAllWorkspaces();

  // Default to the first workspace once the list loads; keep the selection if
  // it's still a valid choice.
  useEffect(() => {
    if (workspaces.length === 0) return;
    if (!workspaces.some((w) => w._id === workspaceId)) {
      setWorkspaceId(workspaces[0]._id);
    }
  }, [workspaces, workspaceId]);

  const { data, isPending, isError } = useWorkspaceDailyOverview(workspaceId, month);
  const overview = data?.data;
  const isCurrentMonth = month === currentMonthKey();
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

  return (
    <PageShell>
      <PageSection>
        {/* Uniform, narrower-than-default width for the whole page — this
            reads as a dense report, not a page meant to fill a wide monitor. */}
        <div className="mx-auto max-w-4xl space-y-5">
          <PageHeading
            kicker="Admin"
            title="Daily Standup Insights"
            subtitle="Who reported today, and how a workspace's standup coverage looks over the month."
            titleAdornment={<Badge variant="outline">Read-only</Badge>}
          />

          <div className="app-panel flex flex-wrap gap-3 p-4">
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
              <SelectTrigger
                className="w-full sm:w-[200px]"
                data-test="daily-insights-month-select"
              >
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
            <div className="app-panel p-6 text-sm text-muted-foreground">
              No workspaces to show yet.
            </div>
          )}

          {workspaceId && isError && (
            <div
              className="app-panel p-6 text-sm text-destructive"
              data-test="daily-insights-error"
            >
              Failed to load daily insights.
            </div>
          )}
          {workspaceId && isPending && (
            <div className="app-panel p-6 text-sm text-muted-foreground">
              Loading daily insights…
            </div>
          )}

          {showContent && (
            <>
              {isCurrentMonth && (
                <TodayStandupCard today={overview.today} onSelect={setSelection} />
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {isCurrentMonth && (
                  <>
                    <AttendanceStat
                      label="Reported today"
                      value={`${overview.stats.reportedToday}/${overview.stats.totalInterns}`}
                      hint="Members"
                      icon={UserCheck}
                      valueClassName="text-emerald-600 dark:text-emerald-400"
                    />
                    <AttendanceStat
                      label="Not reported today"
                      value={overview.stats.notReportedToday}
                      hint={overview.stats.notReportedToday > 0 ? 'Needs a nudge' : 'All clear'}
                      icon={UserX}
                      valueClassName={
                        overview.stats.notReportedToday > 0
                          ? 'text-red-600 dark:text-red-400'
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
                {isCurrentMonth ? (
                  <AttendanceStat
                    label="Open blockers"
                    value={overview.stats.openBlockers}
                    hint="Today"
                    icon={TriangleAlert}
                    valueClassName={
                      overview.stats.openBlockers > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : undefined
                    }
                  />
                ) : (
                  <AttendanceStat
                    label="Missed this month"
                    value={monthMissed}
                    hint={monthLabel}
                    icon={Users}
                    valueClassName={monthMissed > 0 ? 'text-red-600 dark:text-red-400' : undefined}
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
        </div>
      </PageSection>
    </PageShell>
  );
}
