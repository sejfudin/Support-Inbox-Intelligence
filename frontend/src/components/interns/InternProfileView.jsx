import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PagePanel, PageShell, PageSection } from '@/components/PageShell';
import { InternMentorControls } from '@/components/interns/InternMentorControls';
import { InternCommentsPanel } from '@/components/interns/InternCommentsPanel';
import { InternEvaluationsPanel } from '@/components/interns/InternEvaluationsPanel';
import { InternReadinessPanel } from '@/components/interns/InternReadinessPanel';
import { InternRecommendationsPanel } from '@/components/interns/InternRecommendationsPanel';
import { InternCandidateOverview } from '@/components/interns/InternCandidateOverview';
import { InternProfileHeader } from '@/components/interns/InternProfileHeader';
import { InternPanel } from '@/components/interns/InternPanel';
import { useIntern } from '@/queries/interns';
import { useAuth } from '@/context/AuthContext';
import {
  ROLES,
  canViewComments,
  canManageInternDocumentationLinks,
  canChangeInternStatus,
} from '@/helpers/roles';
import { cn } from '@/lib/utils';

const internTabListClassName =
  'flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-b border-border/70 bg-transparent px-5 pb-0 pt-0 text-muted-foreground md:px-6';

const internTabTriggerClassName =
  'h-11 rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 text-sm font-semibold text-muted-foreground shadow-none transition-colors first:pl-0 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none';

export function InternProfileView({
  userId,
  readOnly = false,
  backTo,
  backLabel = 'Back',
  kicker = 'Intern profile',
  analyticsSection = null,
  headingActions = null,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: intern, isPending, isError } = useIntern(userId);

  const canEditDocumentation = !readOnly && canManageInternDocumentationLinks(user?.role);
  const showComments = canViewComments(user?.role);
  const showEvaluations = showComments;
  const showRecommendations =
    user?.role === ROLES.ADMIN || user?.role === ROLES.MENTOR || user?.role === ROLES.LEADERSHIP;

  if (isPending) {
    return (
      <PageShell>
        <PageSection>
          <PagePanel className="flex min-h-[220px] items-center justify-center p-6 text-sm text-muted-foreground">
            Loading intern profile...
          </PagePanel>
        </PageSection>
      </PageShell>
    );
  }

  if (isError || !intern) {
    return (
      <PageShell>
        <PageSection>
          <PagePanel className="space-y-4 p-6">
            <p className="text-sm text-destructive">Unable to load this intern profile.</p>
            {backTo && (
              <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
                {backLabel}
              </Button>
            )}
          </PagePanel>
        </PageSection>
      </PageShell>
    );
  }

  const backButton = backTo ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => navigate(backTo)}
      className="-ml-2 h-7 px-2 text-muted-foreground"
      data-test="intern-profile-back-button"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {backLabel}
    </Button>
  ) : null;
  // Lifecycle status is the assigned mentor's responsibility only — not admins
  // or unassigned mentors. This mirrors the backend guard in updateInternByMentor.
  const canChangeStatus = !readOnly && canChangeInternStatus(user, intern);
  const hasOverviewSidebar = canChangeStatus;
  const formattedStartDate = intern.startDate
    ? format(new Date(intern.startDate), 'MMM d, yyyy')
    : '—';

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <InternProfileHeader
          kicker={kicker}
          fullname={intern.user?.fullname}
          email={intern.user?.email}
          status={intern.status}
          readyForPlacement={intern.readyForPlacement}
          programme={intern.internshipType?.name}
          hub={intern.user?.hub?.name}
          startDate={formattedStartDate}
          primaryMentor={intern.primaryMentor?.fullname}
          backButton={backButton}
          titleAdornment={headingActions}
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className={internTabListClassName} data-test="intern-detail-tabs">
            <TabsTrigger
              value="overview"
              className={internTabTriggerClassName}
              data-test="intern-detail-overview-tab"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="technologies"
              className={internTabTriggerClassName}
              data-test="intern-detail-technologies-tab"
            >
              Technologies
            </TabsTrigger>
            {showEvaluations && (
              <TabsTrigger
                value="evaluations"
                className={internTabTriggerClassName}
                data-test="intern-detail-evaluations-tab"
              >
                Evaluations
              </TabsTrigger>
            )}
            {showRecommendations && (
              <TabsTrigger
                value="recommendations"
                className={internTabTriggerClassName}
                data-test="intern-detail-recommendations-tab"
              >
                Recommendations
              </TabsTrigger>
            )}
            {showComments && (
              <TabsTrigger
                value="notes"
                className={internTabTriggerClassName}
                data-test="intern-detail-notes-tab"
              >
                Mentor notes
              </TabsTrigger>
            )}
            {analyticsSection && (
              <TabsTrigger
                value="analytics"
                className={internTabTriggerClassName}
                data-test="intern-detail-analytics-tab"
              >
                Analytics
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview">
            <div
              className={cn(
                'grid grid-cols-1 gap-8',
                hasOverviewSidebar && 'items-start xl:grid-cols-[minmax(0,1fr)_360px]'
              )}
            >
              <InternPanel className="p-6 md:p-8">
                <InternCandidateOverview
                  intern={intern}
                  userId={userId}
                  canEditDocumentation={canEditDocumentation}
                  programmeMode="minimal"
                />
              </InternPanel>

              {hasOverviewSidebar && canChangeStatus && <InternMentorControls intern={intern} />}
            </div>
          </TabsContent>

          {analyticsSection && (
            <TabsContent value="analytics" className="space-y-6">
              {analyticsSection}
            </TabsContent>
          )}

          <TabsContent value="technologies">
            <InternReadinessPanel
              userId={userId}
              declaredTechnologies={intern.selfTechnologies || []}
              readOnly={readOnly}
            />
          </TabsContent>

          {showEvaluations && (
            <TabsContent value="evaluations">
              <InternEvaluationsPanel userId={userId} readOnly={readOnly} />
            </TabsContent>
          )}

          {showRecommendations && (
            <TabsContent value="recommendations">
              <InternRecommendationsPanel userId={userId} readOnly={readOnly} />
            </TabsContent>
          )}

          {showComments && (
            <TabsContent value="notes">
              <InternCommentsPanel userId={userId} readOnly={readOnly} />
            </TabsContent>
          )}
        </Tabs>
      </PageSection>
    </PageShell>
  );
}
