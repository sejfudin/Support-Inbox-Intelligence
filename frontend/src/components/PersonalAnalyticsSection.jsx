import { useMemo } from 'react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, XAxis } from 'recharts';
import { formatShortDate, formatTooltipDate } from '@/helpers/analyticsFormatters';
import { AnalyticsCardSkeleton } from '@/components/Skeletons/AnalyticsCardSkeleton';
import { AnalyticsEmptyCard } from '@/components/AnalyticsEmptyCard';
import AnalyticsSection from '@/components/analytics/AnalyticsSection';
import { AnalyticsStatRow } from '@/components/analytics/AnalyticsStatCard';
import { cn } from '@/lib/utils';

// Priority tones, per the mockup's donut: Critical → error, High → warning,
// Medium → info, Low → disabled. `stroke` drives the arc via `currentColor`, so
// the colour stays a token rather than a hex baked into the SVG.
const PRIORITY_TONE = {
  Critical: { stroke: 'text-[hsl(var(--tone-danger-fg))]', dot: 'bg-destructive' },
  High: {
    stroke: 'text-[hsl(var(--tone-warning))] dark:text-[hsl(var(--tone-warning-fg))]',
    dot: 'bg-[hsl(var(--tone-warning))]',
  },
  Medium: {
    stroke: 'text-[hsl(var(--tone-info))] dark:text-[hsl(var(--tone-info-fg))]',
    dot: 'bg-[hsl(var(--tone-info))]',
  },
  Low: { stroke: 'text-muted-foreground/40', dot: 'bg-muted-foreground/40' },
};

const toneFor = (name) => PRIORITY_TONE[name] || PRIORITY_TONE.Low;

/**
 * The mockup's donut: a 42-unit viewBox where `r = 15.9` makes the circumference
 * ≈ 100, so each slice's `stroke-dasharray` is simply its percentage. Rotated
 * -90° to start the first slice at twelve o'clock.
 */
function WorkloadDonut({ data, total }) {
  let offset = 0;

  return (
    <div className="flex items-center gap-[18px]">
      <svg viewBox="0 0 42 42" className="h-[124px] w-[124px] flex-none -rotate-90" aria-hidden>
        {data.map((slice) => {
          const pct = total > 0 ? (slice.value / total) * 100 : 0;
          const circle = (
            <circle
              key={slice.name}
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={-offset}
              className={toneFor(slice.name).stroke}
            />
          );
          offset += pct;
          return circle;
        })}
      </svg>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((slice) => (
          <div key={slice.name} className="flex items-center gap-2">
            <span className={cn('h-2 w-2 flex-none rounded-full', toneFor(slice.name).dot)} />
            <span className="flex-1 text-[12px] text-foreground/90">{slice.name}</span>
            <span className="text-[12px] font-semibold tabular-nums text-foreground">
              {slice.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PersonalAnalyticsSection({
  userAnalytics,
  isLoading,
  isError,
  days = 30,
  title = 'Personal Performance',
  description = 'Your ticket load and completion trend in the selected period.',
  activityTitle = 'My throughput',
  workloadTitle = 'Workload distribution',
  showHeader = true,
  headerAction = null,
}) {
  const userSummary = userAnalytics?.summaryStats || {
    completedTickets: 0,
    activeTickets: 0,
  };

  const userPerformance = userAnalytics?.performanceMetrics || {
    averageCycleTimeDays: 0,
    totalTimeSpentHours: 0,
  };

  const userWorkloadData = userAnalytics?.workloadDistribution || [];
  const userActivityData = userAnalytics?.activityTrend || [];

  const userActivityChartConfig = {
    completed: { label: 'Completed', color: 'hsl(var(--primary))' },
  };

  const hasUserWorkloadData = useMemo(
    () => userWorkloadData.some((item) => item.value > 0),
    [userWorkloadData]
  );
  const hasUserActivityData = useMemo(
    () => userActivityData.some((item) => item.completed > 0),
    [userActivityData]
  );

  const workloadTotal = useMemo(
    () => userWorkloadData.reduce((total, item) => total + (Number(item.value) || 0), 0),
    [userWorkloadData]
  );

  // The four tiles the mockup's "My analytics" tab shows, straight off the
  // user-analytics endpoint — it already returns every one of them.
  const stats = useMemo(
    () => [
      {
        label: 'Completed',
        value: userSummary.completedTickets,
        hint: `Last ${days} days`,
      },
      {
        label: 'In progress',
        // "Assigned now", not "Assigned to me": the same tile renders on the intern
        // profile, where the reader is an admin looking at somebody else.
        value: userSummary.activeTickets,
        hint: 'Assigned now',
      },
      {
        label: 'Avg cycle time',
        value: userPerformance.averageCycleTimeDays
          ? `${userPerformance.averageCycleTimeDays.toFixed(2)}d`
          : '—',
        hint: `Across ${userSummary.completedTickets} tickets`,
      },
      {
        label: 'Total time',
        value: `${userPerformance.totalTimeSpentHours.toFixed(1)}h`,
        hint: 'Tracked',
      },
    ],
    [userSummary, userPerformance, days]
  );

  if (isError) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-[var(--r-card)] border border-border bg-card px-6 text-center text-[12.5px] text-[hsl(var(--tone-danger-fg))]">
        Failed to load analytics. Please try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <AnalyticsCardSkeleton />
        <AnalyticsCardSkeleton />
        <div className="lg:col-span-2">
          <AnalyticsCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {showHeader && (
        <AnalyticsSection title={title} description={description} action={headerAction} />
      )}

      <AnalyticsStatRow stats={stats} />

      {/* The mockup's 1.4fr / 1fr row — the wide chart beside the donut. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {hasUserActivityData ? (
          <AnalyticsSection
            title={activityTitle}
            description={`Completed tickets per day, last ${days} days`}
            dataTest="analytics-personal-activity"
          >
            <ChartContainer config={userActivityChartConfig} className="h-[150px] w-full">
              <BarChart data={userActivityData} margin={{ left: 0, right: 0, top: 4 }}>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={7}
                  minTickGap={40}
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 10.5 }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent labelFormatter={(value) => formatTooltipDate(value)} />
                  }
                />
                <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 2, 2]} />
              </BarChart>
            </ChartContainer>
          </AnalyticsSection>
        ) : (
          <AnalyticsEmptyCard
            title={activityTitle}
            description={`Completed tickets per day, last ${days} days`}
          />
        )}

        {hasUserWorkloadData ? (
          <AnalyticsSection
            title={workloadTitle}
            description="Completed tickets by priority"
            className="pb-4"
            dataTest="analytics-personal-workload"
          >
            <WorkloadDonut data={userWorkloadData} total={workloadTotal} />
          </AnalyticsSection>
        ) : (
          <AnalyticsEmptyCard title={workloadTitle} description="Completed tickets by priority" />
        )}
      </div>
    </div>
  );
}
