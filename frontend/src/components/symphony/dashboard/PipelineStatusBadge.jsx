import { getRecommendationStatusLabel } from '@/helpers/recommendations';
import { cn } from '@/lib/utils';

export function PipelineStatusBadge({ activeRecommendation }) {
  if (!activeRecommendation?.status) {
    return <span className="text-xs text-muted-foreground">None</span>;
  }

  const isInterviewing = activeRecommendation.status === 'interviewing';

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
        isInterviewing
          ? 'border border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300'
          : 'border border-primary/35 bg-primary/10 text-primary'
      )}
    >
      {getRecommendationStatusLabel(activeRecommendation.status)}
    </span>
  );
}
