import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import { useProjectOverview } from '@/queries/projects';
import {
  getOutcomeHistoryTone,
  getOutcomeLabel,
  getProjectStatusLabel,
  getSelectionStageLabel,
} from '@/helpers/projects';
import { cn } from '@/lib/utils';

// Clicking a tile scrolls to its section below — it never filters, unlike
// the list page's KPI cards (see LeadershipProjectsPage).
function SectionStatTile({ label, value, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} className="text-left" data-test={testId}>
      <SymphonyCard variant="muted" className="transition-shadow hover:shadow-md">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-3xl font-bold tabular-nums text-foreground">{value}</p>
      </SymphonyCard>
    </button>
  );
}

export default function LeadershipProjectPage() {
  const { id } = useParams();
  const { data, isPending, isError } = useProjectOverview(id);

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
        <p className="text-sm text-destructive">Unable to load this project.</p>
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
          <SymphonyStatusBadge
            status={project.status}
            label={getProjectStatusLabel(project.status)}
          />
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

      <div className="grid gap-4 sm:grid-cols-3">
        <SectionStatTile
          label="Placed"
          value={placed.length}
          onClick={() => scrollTo(placedRef)}
          testId="project-stat-placed"
        />
        <SectionStatTile
          label="In selection"
          value={selection.length}
          onClick={() => scrollTo(selectionRef)}
          testId="project-stat-selection"
        />
        <SectionStatTile
          label="Not placed"
          value={notPlacedCount}
          onClick={() => scrollTo(historyRef)}
          testId="project-stat-not-placed"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <div ref={placedRef} className="scroll-mt-20">
          <SymphonyCard className="flex h-full flex-col">
            <h2 className="font-semibold text-foreground">Currently placed</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Interns staffed on this project right now.
            </p>
            <div className="mt-4 flex-1 space-y-3">
              {placed.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nobody is placed on this project yet.
                </p>
              )}
              {placed.map((intern) => (
                <div
                  key={intern.recommendationId}
                  className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="text-sm font-medium text-foreground">{intern.fullname}</p>
                  <p className="text-xs text-muted-foreground">
                    {intern.position || 'Unspecified role'} · since{' '}
                    {intern.placedAt ? format(new Date(intern.placedAt), 'MMM d, yyyy') : '—'}
                  </p>
                </div>
              ))}
            </div>
          </SymphonyCard>
        </div>

        <div ref={selectionRef} className="scroll-mt-20">
          <SymphonyCard className="flex h-full flex-col">
            <h2 className="font-semibold text-foreground">In selection</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recommended or interviewing for this project.
            </p>
            <div className="mt-4 flex-1 space-y-3">
              {selection.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nobody is currently in selection for this project.
                </p>
              )}
              {selection.map((intern) => (
                <div
                  key={intern.recommendationId}
                  className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {intern.fullname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {intern.position || 'Unspecified role'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {getSelectionStageLabel(intern.stage)}
                  </span>
                </div>
              ))}
            </div>
          </SymphonyCard>
        </div>
      </div>

      <div ref={historyRef} className="scroll-mt-20">
        <SymphonyCard>
          <h2 className="font-semibold text-foreground">Outcome history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone who went through this project, including those not placed.
          </p>
          <div className="mt-4 space-y-3">
            {history.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No outcomes recorded yet.
              </p>
            )}
            {history.map((entry) => (
              <div
                key={entry.recommendationId}
                className="flex flex-wrap items-start justify-between gap-3 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
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
