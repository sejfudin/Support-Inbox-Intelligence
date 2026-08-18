import { useMemo } from 'react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AnalyticsEmptyCard } from '@/components/AnalyticsEmptyCard';
import AnalyticsSection from '@/components/analytics/AnalyticsSection';
import { AnalyticsStatRow } from '@/components/analytics/AnalyticsStatCard';
import { Area, AreaChart, Bar, BarChart, Line, LineChart, XAxis } from 'recharts';
import {
  creationChartConfig,
  cycleChartConfig,
  formatShortDate,
  formatTooltipDate,
  throughputChartConfig,
} from '@/helpers/analyticsFormatters';

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);

/** Mean over the days that actually recorded a cycle time — averaging in the
 *  zero-days would report a number no ticket ever took. */
const meanOfNonZero = (rows, key) => {
  const values = rows.map((row) => Number(row[key]) || 0).filter((value) => value > 0);
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
};

// The mockup's shared axis treatment: no grid, no Y axis, five date ticks under a
// hairline baseline. The numbers live in the stat row and the tooltip.
const AXIS_PROPS = {
  dataKey: 'date',
  tickLine: false,
  axisLine: false,
  tickMargin: 7,
  minTickGap: 40,
  tickFormatter: formatShortDate,
  tick: { fontSize: 10.5 },
};

const CHART_CLASS = 'h-[150px] w-full';

export default function WorkspaceAnalyticsTab({ workspaceAnalytics, days }) {
  const throughputData = workspaceAnalytics?.throughput || [];
  const creationData = workspaceAnalytics?.creationTrend || [];
  const cycleData = workspaceAnalytics?.averageCycleTime || [];

  const hasThroughputData = useMemo(
    () => throughputData.some((item) => item.completed > 0),
    [throughputData]
  );
  const hasCreationData = useMemo(
    () => creationData.some((item) => item.created > 0),
    [creationData]
  );
  const hasCycleData = useMemo(() => cycleData.some((item) => item.avgDays > 0), [cycleData]);

  // Every figure here is derived from the three series the workspace endpoint
  // already returns. The mockup's fourth tile is "Open WIP / n blocked", which
  // needs an aggregate this endpoint does not expose; completion rate is the
  // closest honest stand-in from the same data.
  const stats = useMemo(() => {
    const completed = sum(throughputData, 'completed');
    const created = sum(creationData, 'created');
    const avgCycle = meanOfNonZero(cycleData, 'avgDays');
    const completionRate = created > 0 ? Math.round((completed / created) * 100) : 0;

    return [
      { label: 'Throughput', value: completed, hint: `Completed in ${days} days` },
      { label: 'Created', value: created, hint: `New in ${days} days` },
      {
        label: 'Avg cycle time',
        value: avgCycle > 0 ? `${avgCycle.toFixed(1)}d` : '—',
        hint: 'In progress → done',
        tone: avgCycle > 0 ? 'positive' : 'default',
      },
      {
        label: 'Completion rate',
        value: created > 0 ? `${completionRate}%` : '—',
        hint: 'Completed vs created',
        tone: created > 0 && completionRate < 60 ? 'negative' : 'default',
      },
    ];
  }, [throughputData, creationData, cycleData, days]);

  return (
    <>
      <AnalyticsStatRow stats={stats} />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {hasThroughputData ? (
          <AnalyticsSection
            title="Throughput"
            description="Completed tickets per day"
            dataTest="analytics-workspace-throughput"
          >
            <ChartContainer config={throughputChartConfig} className={CHART_CLASS}>
              <BarChart data={throughputData} margin={{ left: 0, right: 0, top: 4 }}>
                <XAxis {...AXIS_PROPS} />
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
          <AnalyticsEmptyCard title="Throughput" description="Completed tickets per day" />
        )}

        {hasCreationData ? (
          <AnalyticsSection
            title="Creation trend"
            description="New tickets created per day"
            dataTest="analytics-workspace-creation"
          >
            <ChartContainer config={creationChartConfig} className={CHART_CLASS}>
              <LineChart data={creationData} margin={{ left: 0, right: 0, top: 4 }}>
                <XAxis {...AXIS_PROPS} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent labelFormatter={(value) => formatTooltipDate(value)} />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="created"
                  stroke="var(--color-created)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </AnalyticsSection>
        ) : (
          <AnalyticsEmptyCard title="Creation trend" description="New tickets created per day" />
        )}
      </div>

      {hasCycleData ? (
        <AnalyticsSection
          title="Average cycle time"
          description="Average days from in-progress to done"
          dataTest="analytics-workspace-cycle"
        >
          <ChartContainer config={cycleChartConfig} className={CHART_CLASS}>
            <AreaChart data={cycleData} margin={{ left: 0, right: 0, top: 4 }}>
              <defs>
                <linearGradient id="cycleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-avgDays)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-avgDays)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <XAxis {...AXIS_PROPS} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatTooltipDate(value)}
                    formatter={(value) => `${Number(value).toFixed(2)} days`}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="avgDays"
                stroke="var(--color-avgDays)"
                strokeWidth={2}
                fill="url(#cycleGradient)"
              />
            </AreaChart>
          </ChartContainer>
        </AnalyticsSection>
      ) : (
        <AnalyticsEmptyCard
          title="Average cycle time"
          description="Average days from in-progress to done"
        />
      )}
    </>
  );
}
