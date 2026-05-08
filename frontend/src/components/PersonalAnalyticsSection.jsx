import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ANALYTICS_PERIODS,
  formatShortDate,
  formatTooltipDate,
} from '@/helpers/analyticsFormatters';
import { AnalyticsCardSkeleton } from '@/components/Skeletons/AnalyticsCardSkeleton';
import { AnalyticsEmptyCard } from '@/components/AnalyticsEmptyCard';

export default function PersonalAnalyticsSection({
  days,
  setDays,
  userAnalytics,
  isLoading,
  isError,
  kicker = 'My Analytics',
  title = 'Personal Performance',
  description = 'Your ticket load and completion trend in the selected period.',
  periodLabel = 'Last',
  activityTitle = 'My Activity Trend',
  workloadTitle = 'My Workload Distribution',
}) {
  const userSummary = userAnalytics?.summaryStats || {
    completedTickets: 0,
    activeTickets: 0,
    blockedTickets: 0,
  };

  const userPerformance = userAnalytics?.performanceMetrics || {
    averageCycleTimeDays: 0,
    totalTimeSpentHours: 0,
  };

  const userWorkloadData = userAnalytics?.workloadDistribution || [];
  const userActivityData = userAnalytics?.activityTrend || [];

  const workloadColors = {
    Low: 'hsl(210 40% 62%)',
    Medium: 'hsl(215 87% 52%)',
    High: 'hsl(31 95% 52%)',
    Critical: 'hsl(0 84% 60%)',
  };

  const userWorkloadChartConfig = {
    Low: { label: 'Low', color: workloadColors.Low },
    Medium: { label: 'Medium', color: workloadColors.Medium },
    High: { label: 'High', color: workloadColors.High },
    Critical: { label: 'Critical', color: workloadColors.Critical },
  };

  const userActivityChartConfig = {
    completed: {
      label: 'Completed',
      color: 'hsl(178 82% 35%)',
    },
  };

  const hasUserWorkloadData = useMemo(
    () => userWorkloadData.some((item) => item.value > 0),
    [userWorkloadData]
  );
  const hasUserActivityData = useMemo(
    () => userActivityData.some((item) => item.completed > 0),
    [userActivityData]
  );

  if (isError) {
    return (
      <div className="app-panel flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-destructive">
        Failed to load analytics. Please try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsCardSkeleton />
        <AnalyticsCardSkeleton />
        <div className="lg:col-span-2">
          <AnalyticsCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <div className="app-kicker mb-3">{kicker}</div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger className="w-[140px] rounded-full border-primary/15 bg-primary/10 text-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANALYTICS_PERIODS.map((period) => (
                <SelectItem key={period} value={String(period)}>
                  {periodLabel} {period} Days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="app-panel xl:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl">{userSummary.completedTickets}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="app-panel xl:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl">{userSummary.activeTickets}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="app-panel xl:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription>Blocked</CardDescription>
              <CardTitle className="text-3xl">{userSummary.blockedTickets}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="app-panel xl:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription>Avg Cycle Time</CardDescription>
              <CardTitle className="text-3xl">
                {userPerformance.averageCycleTimeDays.toFixed(2)}d
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="app-panel xl:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription>Total Time</CardDescription>
              <CardTitle className="text-3xl">
                {userPerformance.totalTimeSpentHours.toFixed(1)}h
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {hasUserActivityData ? (
            <Card className="app-panel">
              <CardHeader>
                <CardTitle className="text-lg">{activityTitle}</CardTitle>
                <CardDescription>Completed tickets per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={userActivityChartConfig} className="h-[260px] w-full">
                  <LineChart data={userActivityData} margin={{ left: 6, right: 6, top: 12 }}>
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
                      dataKey="completed"
                      stroke="var(--color-completed)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          ) : (
            <AnalyticsEmptyCard title={activityTitle} description="Completed tickets per day" />
          )}

          {hasUserWorkloadData ? (
            <Card className="app-panel">
              <CardHeader>
                <CardTitle className="text-lg">{workloadTitle}</CardTitle>
                <CardDescription>Completed tickets by priority</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={userWorkloadChartConfig} className="h-[260px] w-full">
                  <PieChart>
                    <Pie
                      data={userWorkloadData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {userWorkloadData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={workloadColors[entry.name] || 'hsl(215 16% 47%)'}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => `${name}: ${Number(value)}`}
                        />
                      }
                    />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          ) : (
            <AnalyticsEmptyCard
              title={workloadTitle}
              description="Completed tickets by priority"
            />
          )}
        </div>
      </div>
    </div>
  );
}
