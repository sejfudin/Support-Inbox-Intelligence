import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserAnalytics, useWorkspaceAnalytics } from '@/queries/workspaces';
import { useGenerateUserAiSummary, useGetLatestUserAiSummary } from '@/queries/aiSummaries';
import { useWorkspaceMembershipCheck } from '@/hooks/useWorkspaceMembershipCheck';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsCardSkeleton } from '@/components/Skeletons/AnalyticsCardSkeleton';
import AiSummaryTab from '@/components/analytics/AiSummaryTab';
import PersonalSummaryTab from '@/components/analytics/PersonalSummaryTab';
import WorkspaceAnalyticsTab from '@/components/analytics/WorkspaceAnalyticsTab';

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
              <PersonalSummaryTab
                userAnalytics={userAnalytics}
                isLoading={shouldRenderPersonalPerformance && isUserLoading}
                isError={shouldRenderPersonalPerformance && isUserError}
                days={days}
                onDaysChange={setDays}
              />
            ) : isAiSummaryTab ? (
              <AiSummaryTab
                aiSummary={aiSummary}
                generateAiSummary={generateAiSummary}
                onGenerateAiSummary={handleGenerateAiSummary}
              />
            ) : (
              <WorkspaceAnalyticsTab
                workspaceAnalytics={workspaceAnalytics}
                days={days}
                onDaysChange={setDays}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
