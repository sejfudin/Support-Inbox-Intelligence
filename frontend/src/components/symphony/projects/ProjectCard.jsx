import { Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import { getProjectStatusLabel } from '@/helpers/projects';

export function ProjectCard({ project }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project._id}`)}
      className="block h-full w-full text-left"
      data-test={`project-card-${project._id}`}
    >
      <SymphonyCard className="flex h-full flex-col transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--symphony-brand)/0.12)] text-[hsl(var(--symphony-brand-strong))] dark:text-[hsl(var(--symphony-brand))]">
            <Briefcase className="h-5 w-5" />
          </span>
          <SymphonyStatusBadge
            status={project.status}
            label={getProjectStatusLabel(project.status)}
          />
        </div>

        <div className="mt-4">
          <h3 className="font-semibold text-foreground">{project.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {project.client || 'No client set'}
          </p>
        </div>

        {project.technologies?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
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

        <div className="mt-auto flex items-center gap-6 border-t border-border/60 pt-3.5">
          <div>
            <p className="text-lg font-bold leading-none text-foreground">{project.placedCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">placed</p>
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-[hsl(var(--symphony-brand-strong))] dark:text-[hsl(var(--symphony-brand))]">
              {project.inSelectionCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">in selection</p>
          </div>
        </div>
      </SymphonyCard>
    </button>
  );
}
