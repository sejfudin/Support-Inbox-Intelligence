import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AnalyticsEmptyCard } from '@/components/AnalyticsEmptyCard';
import AnalyticsPeriodSelect from '@/components/analytics/AnalyticsPeriodSelect';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  creationChartConfig,
  cycleChartConfig,
  formatShortDate,
  formatTooltipDate,
  throughputChartConfig,
} from '@/helpers/analyticsFormatters';

export default function WorkspaceAnalyticsTab({ workspaceAnalytics, days, onDaysChange }) {
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

  return (
    <>
      <div className="app-panel px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="app-kicker mb-3">Workspace Analytics</div>
            <h2 className="text-2xl font-semibold tracking-tight">Team Delivery Signals</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Overall workspace throughput, demand and cycle behavior.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <AnalyticsPeriodSelect
              days={days}
              onDaysChange={onDaysChange}
              dataTestPrefix="analytics-workspace"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {hasThroughputData ? (
          <Card className="app-panel">
            <CardHeader>
              <CardTitle className="text-lg">Throughput</CardTitle>
              <CardDescription>Completed tasks per day</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={throughputChartConfig} className="h-[260px] w-full">
                <BarChart data={throughputData} margin={{ left: 6, right: 6, top: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={30}
                    tickFormatter={formatShortDate}
                  />
                  <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent labelFormatter={(value) => formatTooltipDate(value)} />
                    }
                  />
                  <Bar dataKey="completed" fill="var(--color-completed)" radius={[8, 8, 2, 2]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : (
          <AnalyticsEmptyCard title="Throughput" description="Completed tasks per day" />
        )}

        {hasCreationData ? (
          <Card className="app-panel">
            <CardHeader>
              <CardTitle className="text-lg">Creation Trend</CardTitle>
              <CardDescription>New tickets created per day</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={creationChartConfig} className="h-[260px] w-full">
                <LineChart data={creationData} margin={{ left: 6, right: 6, top: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={30}
                    tickFormatter={formatShortDate}
                  />
                  <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent labelFormatter={(value) => formatTooltipDate(value)} />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="var(--color-created)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : (
          <AnalyticsEmptyCard title="Creation Trend" description="New tickets created per day" />
        )}

        {hasCycleData ? (
          <Card className="app-panel lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Average Cycle Time</CardTitle>
              <CardDescription>Average days from in-progress to done</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={cycleChartConfig} className="h-[300px] w-full">
                <AreaChart data={cycleData} margin={{ left: 6, right: 6, top: 12 }}>
                  <defs>
                    <linearGradient id="cycleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-avgDays)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--color-avgDays)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={28}
                    tickFormatter={formatShortDate}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={(v) => `${v}d`}
                    allowDecimals={false}
                  />
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
                    strokeWidth={2.5}
                    fill="url(#cycleGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : (
          <div className="lg:col-span-2">
            <AnalyticsEmptyCard
              title="Average Cycle Time"
              description="Average days from in-progress to done"
            />
          </div>
        )}
      </div>
    </>
  );
}
