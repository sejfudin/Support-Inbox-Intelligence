import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserAnalytics, useWorkspaceAnalytics } from '@/queries/workspaces';
import { useGenerateUserAiSummary, useGetLatestUserAiSummary } from '@/queries/aiSummaries';
import { useWorkspaceMembershipCheck } from '@/hooks/useWorkspaceMembershipCheck';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsCardSkeleton } from '@/components/Skeletons/AnalyticsCardSkeleton';
import AiSummaryTab from '@/components/analytics/AiSummaryTab';
import AnalyticsPeriodSelect from '@/components/analytics/AnalyticsPeriodSelect';
import PersonalSummaryTab from '@/components/analytics/PersonalSummaryTab';
import WorkspaceAnalyticsTab from '@/components/analytics/WorkspaceAnalyticsTab';
import PageHeading from '@/components/PageHeading';

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
    if (
      (activeTab === 'personal' || activeTab === 'ai-summary') &&
      !shouldRenderPersonalPerformance
    ) {
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

  const tabLoadingState = {
    workspace: isWorkspaceLoading,
    personal: isMembershipCheckPending || (shouldRenderPersonalPerformance && isUserLoading),
    'ai-summary':
      isMembershipCheckPending || (shouldRenderPersonalPerformance && isLatestSummaryLoading),
  };

  const tabErrorState = {
    workspace: isWorkspaceError,
    personal: isMembershipCheckError || (shouldRenderPersonalPerformance && isUserError),
    'ai-summary':
      isMembershipCheckError || (shouldRenderPersonalPerformance && isLatestSummaryError),
  };

  const isLoading = tabLoadingState[activeTab] ?? isMembershipCheckPending;
  const isError = tabErrorState[activeTab] ?? isMembershipCheckError;

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

  // 44px underline tabs, 13px, active = foreground text over a 2px primary edge.
  // Not the tickets page's pills: there the tabs are a status filter over one
  // dataset, here they switch between three different reports.
  const tabTriggerClass =
    'mx-2.5 h-11 rounded-none border-0 bg-transparent px-1 text-[13px] font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]';

  return (
    <div className="app-page">
      <div className="app-page-content pb-0">
        <PageHeading
          crumb="Workspace"
          title="Analytics"
          subtitle="Delivery pace, demand trend and cycle performance."
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} data-analytics-tabs>
          {/* The tab band: bleeds the page gutter so its background spans the full
              column, then pads it back to the same 48px the cards below sit at,
              so the first tab lines up with the card edge. Carries the period
              control on its right, exactly as the mockup does. The period select
              used to sit inside each tab's own header card, which meant three
              different places depending on which tab you were on. */}
          <div className="-mx-6 flex items-center justify-between gap-4 border-b border-separator bg-card px-6">
            <TabsList className="-mx-2.5 flex h-auto justify-start gap-1 rounded-none bg-transparent p-0">
              <TabsTrigger
                value="workspace"
                className={tabTriggerClass}
                data-test="analytics-workspace-tab"
              >
                Workspace
              </TabsTrigger>
              {shouldRenderPersonalPerformance && (
                <TabsTrigger
                  value="personal"
                  className={tabTriggerClass}
                  data-test="analytics-personal-tab"
                >
                  My analytics
                </TabsTrigger>
              )}
              {shouldRenderPersonalPerformance && (
                <TabsTrigger
                  value="ai-summary"
                  className={tabTriggerClass}
                  data-test="analytics-ai-summary-tab"
                >
                  Performance summary
                </TabsTrigger>
              )}
            </TabsList>

            {!isAiSummaryTab ? (
              <div className="my-2 flex-none">
                <AnalyticsPeriodSelect
                  days={days}
                  onDaysChange={setDays}
                  dataTestPrefix="analytics"
                />
              </div>
            ) : null}
          </div>
        </Tabs>

        {/* Mockup content box: 18px 24px 32px, 14px between rows. */}
        <div className="-mx-6 flex flex-col gap-3.5 px-6 pb-8 pt-[18px]">
          {isError ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-[var(--r-card)] border border-border bg-card px-6 text-center text-[12.5px] text-[hsl(var(--tone-danger-fg))]">
              Failed to load analytics. Please try again.
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <AnalyticsCardSkeleton />
              <AnalyticsCardSkeleton />
              <div className="lg:col-span-2">
                <AnalyticsCardSkeleton />
              </div>
            </div>
          ) : isPersonalTab ? (
            <PersonalSummaryTab
              userAnalytics={userAnalytics}
              isLoading={shouldRenderPersonalPerformance && isUserLoading}
              isError={shouldRenderPersonalPerformance && isUserError}
              days={days}
            />
          ) : isAiSummaryTab ? (
            <AiSummaryTab
              aiSummary={aiSummary}
              generateAiSummary={generateAiSummary}
              onGenerateAiSummary={handleGenerateAiSummary}
            />
          ) : (
            <WorkspaceAnalyticsTab workspaceAnalytics={workspaceAnalytics} days={days} />
          )}
        </div>
      </div>
    </div>
  );
}
