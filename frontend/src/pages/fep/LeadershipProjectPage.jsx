import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, History, UserCheck, UserPlus, Users } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import { ProjectTypeBadge } from '@/components/projects/ProjectTypeBadge';
import { RequestFormModal } from '@/components/symphony/requests/RequestFormModal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProjectOverview } from '@/queries/projects';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getOutcomeHistoryTone,
  getOutcomeLabel,
  getProjectStatusLabel,
  getSelectionStageLabel,
  getSelectionStageTheme,
} from '@/helpers/projects';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';

// Clicking a tile scrolls to its section below — it never filters, unlike
// the list page's KPI cards (see LeadershipProjectsPage). `dot` gives each
// tile its own color identity instead of three identical grey cards.
function SectionStatTile({ label, value, dot, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} className="text-left" data-test={testId}>
      <SymphonyCard variant="muted" className="transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
        <p className="mt-1.5 text-3xl font-bold tabular-nums text-foreground">{value}</p>
      </SymphonyCard>
    </button>
  );
}

function SectionHeading({ icon: Icon, tint, title, subtitle }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tint)}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function PersonAvatar({ user, fullname, className }) {
  return (
    <UserAvatar
      user={user}
      name={fullname}
      className={cn('h-9 w-9 text-xs font-semibold', className)}
      showTitle={false}
    />
  );
}

export default function LeadershipProjectPage() {
  const { id } = useParams();
  const { data, isPending, isError } = useProjectOverview(id);
  useDocumentTitle(data?.project?.name);
  const [requestOpen, setRequestOpen] = useState(false);

  const placedRef = useRef(null);
  const selectionRef = useRef(null);
  const historyRef = useRef(null);

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading project...</p>;
  }

  if (isError || !data?.project) {
    return (
      <SymphonyCard className="space-y-4">
        <p className="text-sm text-[hsl(var(--tone-danger-fg))]">Unable to load this project.</p>
        <Link to="/projects" className="text-sm font-medium text-primary hover:underline">
          Back to projects
        </Link>
      </SymphonyCard>
    );
  }

  const { project, placed, selection, history } = data;
  // "Not placed" here is neutral — a resulted-but-unplaced engagement, not a
  // negative mark against the intern (see getOutcomeHistoryTone).
  const notPlacedCount = history.filter((entry) => entry.outcome !== 'placed').length;

  return (
    <div className="space-y-8">
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        data-test="project-back-link"
      >
        <ArrowLeft className="h-4 w-4" />
        All projects
      </Link>

      <SymphonyPageHeader
        kicker={project.client || 'Client engagement'}
        title={project.name}
        subtitle={project.description || undefined}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <ProjectTypeBadge type={project.type} />
            <SymphonyStatusBadge
              status={project.status}
              label={getProjectStatusLabel(project.status)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setRequestOpen(true)}
              data-test="project-request-interns-button"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Request interns
            </Button>
          </div>
        }
      >
        {project.technologies?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.technologies.map((tech) => (
              <span
                key={tech._id}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {tech.name}
              </span>
            ))}
          </div>
        )}
      </SymphonyPageHeader>

      <RequestFormModal open={requestOpen} onOpenChange={setRequestOpen} initialProject={project} />

      <div className="grid gap-4 sm:grid-cols-3">
        <SectionStatTile
          label="Placed"
          value={placed.length}
          dot="#2FA98C"
          onClick={() => scrollTo(placedRef)}
          testId="project-stat-placed"
        />
        <SectionStatTile
          label="In selection"
          value={selection.length}
          dot="#6C63FF"
          onClick={() => scrollTo(selectionRef)}
          testId="project-stat-selection"
        />
        <SectionStatTile
          label="Not placed"
          value={notPlacedCount}
          dot="#94A3B8"
          onClick={() => scrollTo(historyRef)}
          testId="project-stat-not-placed"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <div ref={placedRef} className="scroll-mt-20">
          <SymphonyCard className="flex h-full flex-col">
            <SectionHeading
              icon={UserCheck}
              tint="bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
              title="Currently placed"
              subtitle="Interns staffed on this project right now."
            />
            <div className="mt-4 flex-1 space-y-2.5">
              {placed.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nobody is placed on this project yet.
                </p>
              )}
              {placed.map((intern) => (
                <div
                  key={intern.recommendationId}
                  className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5 dark:border-emerald-500/15"
                >
                  <PersonAvatar
                    user={intern}
                    fullname={intern.fullname}
                    className="bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {intern.fullname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {intern.position || 'Unspecified role'} · since{' '}
                      {intern.placedAt ? format(new Date(intern.placedAt), 'MMM d, yyyy') : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SymphonyCard>
        </div>

        <div ref={selectionRef} className="scroll-mt-20">
          <SymphonyCard className="flex h-full flex-col">
            <SectionHeading
              icon={Users}
              tint="bg-[hsl(var(--symphony-brand)/0.14)] text-[hsl(var(--symphony-brand-strong))] dark:text-[hsl(var(--symphony-brand))]"
              title="In selection"
              subtitle="Recommended or interviewing for this project."
            />
            <div className="mt-4 flex-1 space-y-2.5">
              {selection.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nobody is currently in selection for this project.
                </p>
              )}
              {selection.map((intern) => {
                const theme = getSelectionStageTheme(intern.stage);
                return (
                  <div
                    key={intern.recommendationId}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                      theme.panel
                    )}
                  >
                    <PersonAvatar
                      user={intern}
                      fullname={intern.fullname}
                      className={theme.avatar}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {intern.fullname}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {intern.position || 'Unspecified role'}
                      </p>
                    </div>
                    <Badge variant={theme.badge} className="shrink-0">
                      {getSelectionStageLabel(intern.stage)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </SymphonyCard>
        </div>
      </div>

      <div ref={historyRef} className="scroll-mt-20">
        <SymphonyCard>
          <SectionHeading
            icon={History}
            tint="bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300"
            title="Outcome history"
            subtitle="Everyone who went through this project, including those not placed."
          />
          <div className="mt-4 space-y-2.5">
            {history.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No outcomes recorded yet.
              </p>
            )}
            {history.map((entry) => (
              <div
                key={entry.recommendationId}
                className={cn(
                  'flex flex-wrap items-start justify-between gap-3 rounded-lg border-l-2 bg-muted/20 px-3 py-3',
                  entry.outcome === 'placed'
                    ? 'border-l-emerald-500'
                    : 'border-l-slate-300 dark:border-l-slate-600'
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{entry.fullname}</p>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium',
                        getOutcomeHistoryTone(entry.outcome)
                      )}
                    >
                      {getOutcomeLabel(entry.outcome)}
                    </span>
                  </div>
                  {entry.note && <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.date ? format(new Date(entry.date), 'MMM d, yyyy') : '—'}
                </span>
              </div>
            ))}
          </div>
        </SymphonyCard>
      </div>
    </div>
  );
}
