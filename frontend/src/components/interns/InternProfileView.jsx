import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeading from '@/components/PageHeading';
import { PagePanel, PageShell, PageSection } from '@/components/PageShell';
import { InternMentorControls } from '@/components/interns/InternMentorControls';
import { InternCommentsPanel } from '@/components/interns/InternCommentsPanel';
import { InternEvaluationsPanel } from '@/components/interns/InternEvaluationsPanel';
import { InternReadinessPanel } from '@/components/interns/InternReadinessPanel';
import { InternPanel } from '@/components/interns/InternPanel';
import { useIntern } from '@/queries/interns';
import { useAuth } from '@/context/AuthContext';
import { canViewComments, canWriteInternMentorData } from '@/helpers/roles';
import { getInternStatusLabel } from '@/helpers/internProfile';

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

  const canWrite = !readOnly && canWriteInternMentorData(user?.role);
  const showComments = canViewComments(user?.role);
  const showEvaluations = showComments;

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

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          kicker={kicker}
          title={intern.user?.fullname || 'Intern'}
          subtitle={intern.user?.email}
          beforeKicker={backButton}
          actions={headingActions}
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Programme</p>
              <p className="font-medium text-foreground">{intern.internshipType?.name || '—'}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{getInternStatusLabel(intern.status)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Hub</p>
              <p className="font-medium text-foreground">{intern.user?.hub?.name || '—'}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Start date</p>
              <p className="font-medium text-foreground">
                {intern.startDate ? format(new Date(intern.startDate), 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>
        </PageHeading>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList data-test="intern-detail-tabs">
            <TabsTrigger value="overview" data-test="intern-detail-overview-tab">
              Overview
            </TabsTrigger>
            {analyticsSection && (
              <TabsTrigger value="analytics" data-test="intern-detail-analytics-tab">
                Analytics
              </TabsTrigger>
            )}
            <TabsTrigger value="technologies" data-test="intern-detail-technologies-tab">
              Technologies
            </TabsTrigger>
            {showEvaluations && (
              <TabsTrigger value="evaluations" data-test="intern-detail-evaluations-tab">
                Evaluations
              </TabsTrigger>
            )}
            {showComments && (
              <TabsTrigger value="notes" data-test="intern-detail-notes-tab">
                Mentor notes
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <InternPanel>
                <h3 className="text-lg font-semibold text-foreground">Programme details</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Primary mentor</dt>
                    <dd className="font-medium text-foreground">
                      {intern.primaryMentor?.fullname || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Secondary mentor</dt>
                    <dd className="font-medium text-foreground">
                      {intern.secondaryMentor?.fullname || '—'}
                    </dd>
                  </div>
                  {intern.readyForPlacement !== undefined && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Ready for placement</dt>
                      <dd className="font-medium text-foreground">
                        {intern.readyForPlacement ? 'Yes' : 'No'}
                      </dd>
                    </div>
                  )}
                </dl>
              </InternPanel>

              <InternPanel>
                <h3 className="text-lg font-semibold text-foreground">Declared technologies</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(intern.selfTechnologies || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No technologies declared yet.</p>
                  )}
                  {(intern.selfTechnologies || []).map((tech) => (
                    <span
                      key={tech._id}
                      className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm"
                    >
                      {tech.name}
                    </span>
                  ))}
                </div>
                {intern.cvUrl && (
                  <a
                    href={intern.cvUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex text-sm font-medium text-primary hover:underline"
                    data-test="intern-cv-download-link"
                  >
                    Download CV
                  </a>
                )}
              </InternPanel>
            </div>

            {canWrite && <InternMentorControls intern={intern} />}
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
