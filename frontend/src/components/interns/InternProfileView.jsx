import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PagePanel, PageShell, PageSection } from '@/components/PageShell';
import { InternProgrammeControls } from '@/components/interns/InternProgrammeControls';
import { InternCommentsPanel } from '@/components/interns/InternCommentsPanel';
import { InternEvaluationsPanel } from '@/components/interns/InternEvaluationsPanel';
import { InternReadinessPanel } from '@/components/interns/InternReadinessPanel';
import { InternRoleReadinessPanel } from '@/components/interns/InternRoleReadinessPanel';
import { InternRecommendationsPanel } from '@/components/interns/InternRecommendationsPanel';
import { InternCandidateOverview } from '@/components/interns/InternCandidateOverview';
import { InternProfileHeader } from '@/components/interns/InternProfileHeader';
import { InternPanel } from '@/components/interns/InternPanel';
import InternAttendancePanel from '@/components/interns/InternAttendancePanel';
import { TransferPrimaryMentorModal } from '@/components/interns/TransferPrimaryMentorModal';
import { useIntern } from '@/queries/interns';
import { useAuth } from '@/context/AuthContext';
import { ROLES, canViewComments, canManageInternDocumentationLinks } from '@/helpers/roles';
import { resolveUserId } from '@/helpers/userIdentity';
import { cn } from '@/lib/utils';
import { Loader, useLoaderHold } from '@/components/ui/loader';

// The strip closes the identity band, so it carries the hairline above it rather
// than below — the band's own bottom border is what separates it from the content.
const internTabListClassName =
  'flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-t border-separator bg-transparent p-0 text-muted-foreground';

// Active = dark label + primary underline, NOT a primary-coloured label: the
// underline already carries the accent, and colouring the word too makes the
// selected tab read as a link while every other tab reads as text.
const internTabTriggerClassName =
  'h-10 shrink-0 rounded-none bg-transparent px-3 text-[12.5px] font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]';

export function InternProfileView({
  userId,
  readOnly = false,
  backTo,
  backLabel = 'Back',
  analyticsSection = null,
  headingActions = null,
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: intern, isPending: isPendingRaw, isError } = useIntern(userId);
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });
  const [transferMentorOpen, setTransferMentorOpen] = useState(false);

  const canEditDocumentation = !readOnly && canManageInternDocumentationLinks(user, intern);
  // Editing the internal CV link is admin-only; mentors keep read access to
  // whatever link is already on the profile (see canSeeInternalCv, backend).
  const canEditInternalCv = !readOnly && user?.role === ROLES.ADMIN;
  // Generating a CV summary is a write (it caches on the profile and spends a
  // model call), so leadership reads but never generates. The mentor case is a
  // role check only — the service re-checks that they are actually this intern's
  // assigned mentor, same as every other mentor write here.
  const canGenerateCvSummary =
    !readOnly && (user?.role === ROLES.ADMIN || user?.role === ROLES.MENTOR);
  const showComments = canViewComments(user?.role);
  const showEvaluations = user?.role === ROLES.ADMIN;
  const showReadiness = user?.role === ROLES.ADMIN;
  const showRecommendations = user?.role === ROLES.ADMIN || user?.role === ROLES.LEADERSHIP;
  // Admin and mentor: a mentor is the primary reader of their intern's
  // attendance, and `GET /attendance/:internProfileId` admits both roles.
  const showAttendance = user?.role === ROLES.ADMIN || user?.role === ROLES.MENTOR;
  // Self-scoped, mirroring the server check in
  // internService.js#transferPrimaryMentor: only the admin who currently *is*
  // this intern's primary mentor sees the hand-off action, not every admin.
  const canTransferPrimaryMentor =
    !readOnly &&
    user?.role === ROLES.ADMIN &&
    resolveUserId(intern?.primaryMentor) === resolveUserId(user);

  // Which tab is open lives in the URL, so a link can point at one — the
  // recommendations table sends an admin straight to the intern's own
  // recommendations rather than dropping them on Overview to find the tab
  // themselves. A `?tab=` naming a tab this viewer cannot see (readiness is
  // admin-only) falls back to Overview rather than rendering an empty pane.
  const visibleTabs = [
    'overview',
    showReadiness && 'readiness',
    showEvaluations && 'evaluations',
    showRecommendations && 'recommendations',
    showComments && 'notes',
    showAttendance && 'attendance',
    analyticsSection && 'analytics',
  ].filter(Boolean);

  const requestedTab = searchParams.get('tab');
  const activeTab = visibleTabs.includes(requestedTab) ? requestedTab : 'overview';

  // `replace` so switching tabs does not stack history entries the back button
  // then has to walk through to leave the profile.
  const onTabChange = (next) =>
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        if (next === 'overview') updated.delete('tab');
        else updated.set('tab', next);
        return updated;
      },
      { replace: true }
    );

  if (isPending) {
    return (
      <PageShell>
        <PageSection>
          {/* The panels below this one are decided by the intern's own record — which tabs
              exist, whether there is a specialization, whether attendance applies — so the page
              can't lay itself out yet. The 220px is kept so it doesn't grow underneath. */}
          <PagePanel className="flex min-h-[220px] items-center justify-center p-6">
            <Loader label="Loading intern profile…" />
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
            <p className="text-sm text-[hsl(var(--tone-danger-fg))]">
              Unable to load this intern profile.
            </p>
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
      className="-ml-2 h-7 px-2 text-[12.5px] text-muted-foreground"
      data-test="intern-profile-back-button"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {backLabel}
    </Button>
  ) : null;
  // Lifecycle status changes are admin-only. This mirrors the backend guard
  // in updateInternProgramme.
  const canChangeStatus = !readOnly && user?.role === ROLES.ADMIN;
  const hasOverviewSidebar = canChangeStatus;
  const formattedStartDate = intern.startDate
    ? format(new Date(intern.startDate), 'MMM d, yyyy')
    : '—';

  const tabStrip = (
    <TabsList className={internTabListClassName} data-test="intern-detail-tabs">
      <TabsTrigger
        value="overview"
        className={internTabTriggerClassName}
        data-test="intern-detail-overview-tab"
      >
        Overview
      </TabsTrigger>
      {showReadiness && (
        <TabsTrigger
          value="readiness"
          className={internTabTriggerClassName}
          data-test="intern-detail-readiness-tab"
        >
          Readiness
        </TabsTrigger>
      )}
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
      {showAttendance && (
        <TabsTrigger
          value="attendance"
          className={internTabTriggerClassName}
          data-test="intern-detail-attendance-tab"
        >
          Attendance
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
  );

  return (
    <PageShell>
      <PageSection>
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <InternProfileHeader
            user={intern.user}
            fullname={intern.user?.fullname}
            email={intern.user?.email}
            status={intern.status}
            declaredPosition={intern.declaredPosition?.name}
            programme={intern.internshipType?.name}
            hub={intern.user?.hub?.name}
            startDate={formattedStartDate}
            primaryMentor={intern.primaryMentor?.fullname}
            primaryMentorAction={
              canTransferPrimaryMentor ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 shrink-0 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setTransferMentorOpen(true)}
                  data-test="intern-transfer-primary-mentor-button"
                >
                  Transfer
                </Button>
              ) : null
            }
            secondaryMentor={intern.secondaryMentor?.fullname}
            backButton={backButton}
            titleAdornment={headingActions}
            tabs={tabStrip}
          />

          {/* The band above bleeds into the gutter and closes with its own border,
              so the panels below start at the mockup's 18px rather than at
              `.app-page-content`'s 24px. */}
          <div className="mt-[18px]">
            <TabsContent value="overview">
              <div
                className={cn(
                  'grid grid-cols-1 gap-3.5',
                  hasOverviewSidebar && 'items-start xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'
                )}
              >
                <InternPanel dense>
                  <InternCandidateOverview
                    intern={intern}
                    userId={userId}
                    canEditDocumentation={canEditDocumentation}
                    canEditInternalCv={canEditInternalCv}
                    canGenerateCvSummary={canGenerateCvSummary}
                  />
                </InternPanel>

                {hasOverviewSidebar && canChangeStatus && (
                  <InternProgrammeControls intern={intern} />
                )}
              </div>
            </TabsContent>

            {showAttendance && (
              <TabsContent value="attendance">
                <InternAttendancePanel internProfileId={intern.id} />
              </TabsContent>
            )}

            {analyticsSection && <TabsContent value="analytics">{analyticsSection}</TabsContent>}

            {showReadiness && (
              <TabsContent value="readiness">
                <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <InternReadinessPanel
                    userId={userId}
                    declaredTechnologies={intern.selfTechnologies || []}
                    readOnly={readOnly}
                  />
                  <InternRoleReadinessPanel
                    userId={userId}
                    declaredPosition={intern.declaredPosition}
                    readOnly={readOnly}
                  />
                </div>
              </TabsContent>
            )}

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
                <InternCommentsPanel
                  userId={userId}
                  internName={intern?.user?.fullname}
                  readOnly={readOnly}
                />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </PageSection>

      {canTransferPrimaryMentor && (
        <TransferPrimaryMentorModal
          intern={intern}
          open={transferMentorOpen}
          onClose={() => setTransferMentorOpen(false)}
        />
      )}
    </PageShell>
  );
}
