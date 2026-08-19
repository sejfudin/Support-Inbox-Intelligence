import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { resolveUserId, resolveUserName } from '@/helpers/userIdentity';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';

/**
 * A stack of people, overlapped, with a tooltip each and a `+N` when it overflows.
 *
 * Each circle is a `UserAvatar`, so a person's photo appears here for the same
 * reason it appears anywhere else — there is one component that knows how to draw
 * a person, and this is the one that knows how to overlap several of them.
 *
 * Sizes are the design's three — 24 in a table row, 30 in a list or card, 52 on a
 * profile. Fixed rather than tokenised on purpose: an avatar is an identifier, not
 * a control, and shrinking it under compact density costs recognition without
 * buying back a useful amount of row height.
 *
 * `className` reaches each circle. It used to be accepted and silently dropped,
 * which is why a deleted comment's avatar never actually greyed out.
 */
const RING = {
  // Alone at the end of a card-footer row rather than in a stack, so it carries
  // no ring.
  xs: 'border-0',
  sm: 'border',
  md: 'border-2',
  lg: 'border-2',
};

const REMAINING_SIZE = {
  xs: 'h-6 w-6 text-[9.5px] border-0',
  sm: 'h-6 w-6 text-[9.5px] border',
  md: 'h-[30px] w-[30px] text-[10px] border-2',
  lg: 'h-[52px] w-[52px] text-[12px] border-2',
};

export const Avatar = ({ users, size = 'md', className, maxVisible = 3 }) => {
  const safeUsers = (users || []).filter(Boolean);

  if (safeUsers.length === 0) {
    return <span className="text-muted-foreground italic text-xs px-1">Unassigned</span>;
  }

  const displayUsers = safeUsers.slice(0, maxVisible);
  const remainingCount = safeUsers.length - maxVisible;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex -space-x-2 items-center">
        {displayUsers.map((user, index) => (
          <Tooltip key={resolveUserId(user) || resolveUserName(user) || index}>
            <TooltipTrigger asChild>
              <UserAvatar
                user={user}
                size={size}
                // The name is in the tooltip, so a native title tooltip on top of
                // it would fight with it.
                showTitle={false}
                className={cn(
                  'border-background cursor-help transition-all hover:z-10 hover:scale-110',
                  RING[size] ?? RING.md,
                  className
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-bold text-xs">{resolveUserName(user) || 'Unknown user'}</p>
              {user.role ? (
                <p className="text-[10px] opacity-80">{capitalizeFirst(user.role)}</p>
              ) : null}
              <p className="text-[10px] opacity-80">{user.email || 'Unknown email'}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <div
            className={cn(
              'flex items-center justify-center rounded-full border-background bg-secondary text-secondary-foreground font-bold z-0',
              REMAINING_SIZE[size] ?? REMAINING_SIZE.md
            )}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
