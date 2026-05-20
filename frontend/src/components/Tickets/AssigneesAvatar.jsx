import { User } from 'lucide-react';

import { Avatar } from '@/components/Avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const EMPTY_AVATAR_SIZES = {
  sm: { container: 'h-5 w-5', icon: 'h-3 w-3' },
  md: { container: 'h-8 w-8', icon: 'h-4 w-4' },
  lg: { container: 'h-12 w-12', icon: 'h-6 w-6' },
};

function UnassignedAvatar({ emptyLabel, size = 'md' }) {
  const sizeClasses = EMPTY_AVATAR_SIZES[size] ?? EMPTY_AVATAR_SIZES.md;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/35 bg-muted/50 text-muted-foreground ${sizeClasses.container}`}
            aria-label={emptyLabel}
          >
            <User className={sizeClasses.icon} aria-hidden />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{emptyLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function AssigneesAvatar({
  users,
  emptyLabel = 'Unassigned',
  size,
  emptyDisplay = 'text',
}) {
  if (!users || (Array.isArray(users) && users.length === 0)) {
    if (emptyDisplay === 'avatar') {
      return <UnassignedAvatar emptyLabel={emptyLabel} size={size} />;
    }
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }

  return <Avatar users={users} size={size} />;
}
