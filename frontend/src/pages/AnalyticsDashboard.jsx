import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceAnalytics } from "@/queries/workspaces";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Area,
  AreaChart,
} from "recharts";
import {
  ANALYTICS_PERIODS,
  formatShortDate,
  formatTooltipDate,
  throughputChartConfig,
  creationChartConfig,
  cycleChartConfig,
} from "@/helpers/analyticsFormatters";
import { AnalyticsCardSkeleton } from "@/components/Skeletons/AnalyticsCardSkeleton";
import { AnalyticsEmptyCard } from "@/components/AnalyticsEmptyCard";

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId;
  const [days, setDays] = useState(30);

  const { data, isLoading, isError } = useWorkspaceAnalytics({
    workspaceId,
    days,
  });

  const throughputData = data?.throughput || [];
  const creationData = data?.creationTrend || [];
  const cycleData = data?.averageCycleTime || [];

  const hasThroughputData = useMemo(
    () => throughputData.some((item) => item.completed > 0),
    [throughputData],
  );
  const hasCreationData = useMemo(
    () => creationData.some((item) => item.created > 0),
    [creationData],
  );
  const hasCycleData = useMemo(
    () => cycleData.some((item) => item.avgDays > 0),
    [cycleData],
  );

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="app-kicker mb-3">Insights</div>
            <h1 className="app-title">Workspace Analytics</h1>
            <p className="app-subtitle">Understand delivery pace, demand trend, and cycle performance.</p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
              <SelectTrigger className="w-[140px] rounded-full border-primary/15 bg-primary/10 text-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICS_PERIODS.map((period) => (
                  <SelectItem key={period} value={String(period)}>
                    Last {period} Days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isError ? (
          <div className="app-panel flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-destructive">
            Failed to load analytics. Please try again.
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AnalyticsCardSkeleton />
            <AnalyticsCardSkeleton />
            <div className="lg:col-span-2">
              <AnalyticsCardSkeleton />
            </div>
          </div>
        ) : (
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
                        content={(
                          <ChartTooltipContent labelFormatter={(value) => formatTooltipDate(value)} />
                        )}
                      />
                      <Bar dataKey="completed" fill="var(--color-completed)" radius={[8, 8, 2, 2]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : (
              <AnalyticsEmptyCard
                title="Throughput"
                description="Completed tasks per day"
              />
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
                        content={(
                          <ChartTooltipContent labelFormatter={(value) => formatTooltipDate(value)} />
                        )}
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
              <AnalyticsEmptyCard
                title="Creation Trend"
                description="New tickets created per day"
              />
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
                        content={(
                          <ChartTooltipContent
                            labelFormatter={(value) => formatTooltipDate(value)}
                            formatter={(value) => `${Number(value).toFixed(2)} days`}
                          />
                        )}
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
        )}
      </div>
    </div>
  );
}
