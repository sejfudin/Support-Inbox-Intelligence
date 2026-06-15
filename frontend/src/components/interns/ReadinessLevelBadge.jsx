import { getReadinessBadgeClassName, getReadinessLabel } from '@/helpers/internProfile';
import { cn } from '@/lib/utils';

export function ReadinessLevelBadge({ level = 'none', className }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold',
        getReadinessBadgeClassName(level),
        className
      )}
    >
      {getReadinessLabel(level)}
    </span>
  );
}
