import { cloneElement, isValidElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, CalendarDays, Download, GraduationCap, MapPin, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeading from '@/components/PageHeading';
import { PagePanel, PageShell, PageSection } from '@/components/PageShell';
import { InternMentorControls } from '@/components/interns/InternMentorControls';
import { InternCommentsPanel } from '@/components/interns/InternCommentsPanel';
import { InternEvaluationsPanel } from '@/components/interns/InternEvaluationsPanel';
import { InternReadinessPanel } from '@/components/interns/InternReadinessPanel';
import { InternRecommendationsPanel } from '@/components/interns/InternRecommendationsPanel';
import { InternPanel } from '@/components/interns/InternPanel';
import { useIntern } from '@/queries/interns';
import { useAuth } from '@/context/AuthContext';
import { ROLES, canViewComments, canWriteInternMentorData } from '@/helpers/roles';
import { getInternStatusLabel } from '@/helpers/internProfile';
import { cn } from '@/lib/utils';

const INTERN_STATUS_TAG_STYLES = {
  active: {
    tag: 'border-sky-200/80 bg-sky-500/10 text-sky-800 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200',
    dot: 'bg-sky-500',
  },
  ready: {
    tag: 'border-emerald-200/80 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  placed: {
    tag: 'border-emerald-200/80 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  completed: {
    tag: 'border-violet-200/80 bg-violet-500/10 text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
  discontinued: {
    tag: 'border-rose-200/80 bg-rose-500/10 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200',
    dot: 'bg-rose-500',
  },
  default: {
    tag: 'border-border/70 bg-background/70 text-foreground',
    dot: 'bg-muted-foreground',
  },
};

const internProfileTagBaseClass =
  'inline-flex min-h-9 max-w-full min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm backdrop-blur-md';

const staticMetadataTagClass =
  'border-border/70 bg-muted/60 text-muted-foreground dark:border-border/60 dark:bg-muted/30 dark:text-muted-foreground';

const programmeDetailModuleClass =
  'rounded-xl border border-primary/15 bg-primary/10 px-4 py-3 text-primary';

const overviewPanelClass = 'lg:h-[360px]';

const internTabListClassName =
  'flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-b border-border/70 bg-transparent px-5 pb-0 pt-0 text-muted-foreground md:px-6';

const internTabTriggerClassName =
  'h-11 rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 text-sm font-semibold text-muted-foreground shadow-none transition-colors first:pl-0 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none';

function HeaderInfoTag({ icon: Icon, label, value, className }) {
  return (
    <span className={cn(internProfileTagBaseClass, className)}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-xs font-medium opacity-70">{label}</span>
      <span className="min-w-0 truncate">{value || '—'}</span>
    </span>
  );
}

function StatusInfoTag({ status, className }) {
  const statusStyle = INTERN_STATUS_TAG_STYLES[status] || INTERN_STATUS_TAG_STYLES.default;

  return (
    <span className={cn(internProfileTagBaseClass, statusStyle.tag, className)}>
      <span
        className={cn(
          'h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white/70 dark:ring-white/10',
          statusStyle.dot
        )}
        aria-hidden="true"
      />
      <span className="text-xs font-medium opacity-70">Status</span>
      <span className="min-w-0 truncate">{getInternStatusLabel(status) || '—'}</span>
    </span>
  );
}

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
  const formattedStartDate = intern.startDate
    ? format(new Date(intern.startDate), 'MMM d, yyyy')
    : '—';
  const hasOverviewSidebar = canWrite;
  const downloadCvButton = intern.cvUrl ? (
    <Button asChild variant="outline" data-test="intern-cv-download-link">
      <a href={intern.cvUrl} target="_blank" rel="noreferrer">
        <Download className="h-4 w-4" aria-hidden="true" />
        Download CV
      </a>
    </Button>
  ) : null;
  const inlineEditAction =
    headingActions && isValidElement(headingActions)
      ? cloneElement(headingActions, {
          variant: 'ghost',
          size: 'icon',
          className: cn(
            'h-9 w-9 shrink-0 rounded-lg border border-transparent p-0 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground dark:hover:bg-muted',
            headingActions.props.className
          ),
          'aria-label': 'Edit user',
          title: 'Edit user',
          children: <Pencil className="h-4 w-4" aria-hidden="true" />,
        })
      : headingActions;
  const profileMetadata = (
    <div className="flex w-full min-w-0 flex-col gap-2 md:w-72">
      <HeaderInfoTag
        icon={GraduationCap}
        label="Programme"
        value={intern.internshipType?.name}
        className={cn(staticMetadataTagClass, 'w-full justify-start')}
      />
      <StatusInfoTag status={intern.status} className="w-full justify-start" />
      <HeaderInfoTag
        icon={MapPin}
        label="Hub"
        value={intern.user?.hub?.name}
        className={cn(staticMetadataTagClass, 'w-full justify-start')}
      />
      <HeaderInfoTag
        icon={CalendarDays}
        label="Start"
        value={formattedStartDate}
        className={cn(staticMetadataTagClass, 'w-full justify-start')}
      />
    </div>
  );
  const headerActions = (
    <div className="flex w-full flex-col gap-3 md:items-end">
      {downloadCvButton}
      {profileMetadata}
    </div>
  );

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          kicker={kicker}
          title={intern.user?.fullname || 'Intern'}
          titleAdornment={inlineEditAction}
          subtitle={intern.user?.email}
          beforeKicker={backButton}
          actions={headerActions}
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
                hasOverviewSidebar && 'lg:grid-cols-[2fr_1fr]'
              )}
            >
              <InternPanel className={cn('flex flex-col', overviewPanelClass)}>
                <h3 className="text-lg font-semibold text-foreground">Programme details</h3>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className={programmeDetailModuleClass}>
                    <dt className="text-xs font-medium uppercase tracking-[0.08em] opacity-70">
                      Primary mentor
                    </dt>
                    <dd className="mt-1 min-w-0 truncate text-sm font-semibold text-foreground">
                      {intern.primaryMentor?.fullname || '—'}
                    </dd>
                  </div>
                  <div className={programmeDetailModuleClass}>
                    <dt className="text-xs font-medium uppercase tracking-[0.08em] opacity-70">
                      Secondary mentor
                    </dt>
                    <dd className="mt-1 min-w-0 truncate text-sm font-semibold text-foreground">
                      {intern.secondaryMentor?.fullname || '—'}
                    </dd>
                  </div>
                  {intern.readyForPlacement !== undefined && (
                    <div className={programmeDetailModuleClass}>
                      <dt className="text-xs font-medium uppercase tracking-[0.08em] opacity-70">
                        Ready for placement
                      </dt>
                      <dd className="mt-1 min-w-0 truncate text-sm font-semibold text-foreground">
                        {intern.readyForPlacement ? 'Yes' : 'No'}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-border/60 pt-6">
                  <h3 className="text-lg font-semibold text-foreground">Declared technologies</h3>
                  <div className="mt-4 flex min-h-0 flex-wrap gap-2 overflow-y-auto pr-1">
                    {(intern.selfTechnologies || []).length === 0 && (
                      <p className="text-sm italic text-gray-400 dark:text-muted-foreground/60">
                        No technologies declared yet.
                      </p>
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
                </div>
              </InternPanel>

              {hasOverviewSidebar && (
                <div className={cn('space-y-4', overviewPanelClass)}>
                  {canWrite && <InternMentorControls intern={intern} className="h-full" />}
                </div>
              )}
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
