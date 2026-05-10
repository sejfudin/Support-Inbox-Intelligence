import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserAnalytics, useWorkspaceAnalytics } from '@/queries/workspaces';
import { useGenerateUserAiSummary, useGetLatestUserAiSummary } from '@/queries/aiSummaries';
import { useWorkspaceMembershipCheck } from '@/hooks/useWorkspaceMembershipCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from 'recharts';
import {
  ANALYTICS_PERIODS,
  formatShortDate,
  formatTooltipDate,
  throughputChartConfig,
  creationChartConfig,
  cycleChartConfig,
} from '@/helpers/analyticsFormatters';
import { AnalyticsCardSkeleton } from '@/components/Skeletons/AnalyticsCardSkeleton';
import { AnalyticsEmptyCard } from '@/components/AnalyticsEmptyCard';
import PersonalAnalyticsSection from '@/components/PersonalAnalyticsSection';
import { Sparkles } from 'lucide-react';

function AnalyticsPeriodSelect({ days, onDaysChange }) {
  return (
    <Select value={String(days)} onValueChange={(value) => onDaysChange(Number(value))}>
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
  );
}

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId;
  const userId = user?._id || user?.id;
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState('workspace');
  const [aiSummary, setAiSummary] = useState(null);
  const generateAiSummary = useGenerateUserAiSummary();

  const { isWorkspaceMember, isMembershipCheckPending, isMembershipCheckError } =
    useWorkspaceMembershipCheck(workspaceId);

  const shouldRenderPersonalPerformance = Boolean(
    userId &&
    workspaceId &&
    !isMembershipCheckPending &&
    !isMembershipCheckError &&
    isWorkspaceMember
  );

  // Load latest summary when ai-summary tab is active
  const {
    data: latestSummaryResponse,
    isLoading: isLatestSummaryLoading,
    isError: isLatestSummaryError,
  } = useGetLatestUserAiSummary({
    userId,
    workspaceId,
    enabled: shouldRenderPersonalPerformance && activeTab === 'ai-summary',
  });

  // Update aiSummary when latest summary data is fetched
  useEffect(() => {
    if (latestSummaryResponse?.data) {
      setAiSummary(latestSummaryResponse.data);
    }
  }, [latestSummaryResponse?.data]);

  useEffect(() => {
    if ((activeTab === 'personal' || activeTab === 'ai-summary') && !shouldRenderPersonalPerformance) {
      setActiveTab('workspace');
    }
  }, [activeTab, shouldRenderPersonalPerformance]);

  const {
    data: workspaceAnalytics,
    isLoading: isWorkspaceLoading,
    isError: isWorkspaceError,
  } = useWorkspaceAnalytics({
    workspaceId,
    days,
  });

  const {
    data: userAnalytics,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useUserAnalytics({
    userId,
    workspaceId: shouldRenderPersonalPerformance ? workspaceId : null,
    days,
  });

  const isWorkspaceTab = activeTab === 'workspace';
  const isPersonalTab = activeTab === 'personal';
  const isAiSummaryTab = activeTab === 'ai-summary';
  const isLoading = isWorkspaceTab
    ? isWorkspaceLoading
    : isPersonalTab
      ? isMembershipCheckPending || (shouldRenderPersonalPerformance && isUserLoading)
      : isAiSummaryTab
        ? isMembershipCheckPending || (shouldRenderPersonalPerformance && isLatestSummaryLoading)
        : isMembershipCheckPending;
  const isError = isWorkspaceTab
    ? isWorkspaceError
    : isPersonalTab
      ? isMembershipCheckError || (shouldRenderPersonalPerformance && isUserError)
      : isAiSummaryTab
        ? isMembershipCheckError || (shouldRenderPersonalPerformance && isLatestSummaryError)
        : isMembershipCheckError;

  const data = workspaceAnalytics;

  const throughputData = data?.throughput || [];
  const creationData = data?.creationTrend || [];
  const cycleData = data?.averageCycleTime || [];

  const hasThroughputData = useMemo(
    () => throughputData.some((item) => item.completed > 0),
    [throughputData]
  );
  const hasCreationData = useMemo(
    () => creationData.some((item) => item.created > 0),
    [creationData]
  );
  const hasCycleData = useMemo(() => cycleData.some((item) => item.avgDays > 0), [cycleData]);

  const handleGenerateAiSummary = () => {
    if (!userId || !workspaceId || generateAiSummary.isPending) return;

    generateAiSummary.mutate(
      { userId, workspaceId },
      {
        onSuccess: (response) => {
          setAiSummary(response?.data || null);
        },
      }
    );
  };

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="app-kicker mb-3">Insights</div>
            <h1 className="app-title">Workspace Analytics</h1>
            <p className="app-subtitle">
              Understand delivery pace, demand trend, and cycle performance.
            </p>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="rounded-full border border-border/70 bg-secondary/70">
                <TabsTrigger value="workspace" className="rounded-full">
                  Analytics
                </TabsTrigger>
                {shouldRenderPersonalPerformance && (
                  <TabsTrigger value="personal" className="rounded-full">
                    Personal Summary
                  </TabsTrigger>
                )}
                {shouldRenderPersonalPerformance && (
                  <TabsTrigger value="ai-summary" className="rounded-full">
                    AI Summary
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
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
          <div className="space-y-6">
            {isPersonalTab ? (
              <PersonalAnalyticsSection
                userAnalytics={userAnalytics}
                isLoading={shouldRenderPersonalPerformance && isUserLoading}
                isError={shouldRenderPersonalPerformance && isUserError}
                kicker="My Analytics"
                title="Personal Summary"
                description="Your ticket load and completion trend in the selected period."
                headerAction={<AnalyticsPeriodSelect days={days} onDaysChange={setDays} />}
              />
            ) : isAiSummaryTab ? (
              <div className="app-panel px-5 py-5 md:px-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="app-kicker mb-3">AI Summary</div>
                    <h2 className="text-2xl font-semibold tracking-tight">Generated Summary</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      Generate a short personal summary from your recent assigned tickets.
                    </p>
                  </div>

                  <Button onClick={handleGenerateAiSummary} disabled={generateAiSummary.isPending}>
                    <Sparkles className="h-4 w-4" />
                    {generateAiSummary.isPending ? 'Generating...' : 'Generate Summary'}
                  </Button>
                </div>

                {generateAiSummary.isError ? (
                  <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {generateAiSummary.error?.response?.data?.message ||
                      generateAiSummary.error?.message ||
                      'Failed to generate summary.'}
                  </div>
                ) : null}

                <div className="mt-5 rounded-2xl border border-border/70 bg-white/70 p-5">
                  {aiSummary?.summary ? (
                    <>
                      <p className="text-sm leading-7 text-foreground">{aiSummary.summary}</p>
                      {aiSummary.generatedAt ? (
                        <p className="mt-4 text-xs text-muted-foreground">
                          Generated {new Date(aiSummary.generatedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No AI summary generated yet for this session.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="app-panel px-5 py-5 md:px-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="app-kicker mb-3">Workspace Analytics</div>
                      <h2 className="text-2xl font-semibold tracking-tight">
                        Team Delivery Signals
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Overall workspace throughput, demand and cycle behavior.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <AnalyticsPeriodSelect days={days} onDaysChange={setDays} />
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
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              width={32}
                              allowDecimals={false}
                            />
                            <ChartTooltip
                              cursor={false}
                              content={
                                <ChartTooltipContent
                                  labelFormatter={(value) => formatTooltipDate(value)}
                                />
                              }
                            />
                            <Bar
                              dataKey="completed"
                              fill="var(--color-completed)"
                              radius={[8, 8, 2, 2]}
                            />
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
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              width={32}
                              allowDecimals={false}
                            />
                            <ChartTooltip
                              content={
                                <ChartTooltipContent
                                  labelFormatter={(value) => formatTooltipDate(value)}
                                />
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
                                <stop
                                  offset="5%"
                                  stopColor="var(--color-avgDays)"
                                  stopOpacity={0.4}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="var(--color-avgDays)"
                                  stopOpacity={0.05}
                                />
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
