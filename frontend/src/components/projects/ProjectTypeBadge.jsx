import { cn } from '@/lib/utils';
import { getProjectTypeLabel } from '@/helpers/projects';

/**
 * Read-only project type chip, shared by the admin reference-data cards and the
 * leadership project views so the three never drift.
 *
 * Deliberately neutral (no per-type color): every card that shows this also
 * shows a *status* badge, and status is where color carries meaning
 * (SymphonyStatusBadge). A second colored badge would leave the viewer guessing
 * which color signals what — and the type list is still growing, so per-type
 * colors would need inventing again on every addition.
 *
 * Renders nothing when `type` is missing, which is only possible on a project
 * created before the field existed and not yet covered by
 * server/seeder/backfillProjectTypes.js.
 */
export function ProjectTypeBadge({ type, className }) {
  if (!type) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground',
        className
      )}
      data-test={`project-type-badge-${type}`}
    >
      {getProjectTypeLabel(type)}
    </span>
  );
}
