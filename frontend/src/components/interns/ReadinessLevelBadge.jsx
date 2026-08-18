import { getReadinessBadgeClassName, getReadinessLabel } from '@/helpers/internProfile';
import { CHIP } from '@/helpers/badgeTones';
import { cn } from '@/lib/utils';

/** One look, sentence case — see `RoleBadge` for why the bordered pill went. */
export function ReadinessLevelBadge({ level = 'none', className }) {
  return (
    <span className={cn(CHIP, 'shrink-0 border-0', getReadinessBadgeClassName(level), className)}>
      {getReadinessLabel(level)}
    </span>
  );
}
