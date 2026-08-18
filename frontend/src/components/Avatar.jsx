import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { getInitials } from '@/helpers/getInitials';
import { getAvatarColor } from '@/helpers/avatarColor';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
/**
 * A stack of people, overlapped, with a tooltip each and a `+N` when it overflows.
 *
 * Sizes are the design's three — 24 in a table row, 30 in a list or card, 52 on a
 * profile — matching `ui/initials-avatar`, which is the same circle for one
 * person. They used to be 20/32/48, which is why an assignee stack never quite
 * lined up with the single avatar in the row above it.
 *
 * Fixed rather than tokenised on purpose: an avatar is an identifier, not a
 * control, and shrinking it under compact density costs recognition without
 * buying back a useful amount of row height.
 */
export const Avatar = ({ users, size = 'md' }) => {
  const safeUsers = (users || []).filter(Boolean);

  if (safeUsers.length === 0) {
    return <span className="text-muted-foreground italic text-xs px-1">Unassigned</span>;
  }
  const maxVisible = 3;
  const displayUsers = safeUsers.slice(0, maxVisible);
  const remainingCount = safeUsers.length - maxVisible;
  const sizeClasses =
    size === 'xs'
      ? {
          // Alone at the end of a card-footer row rather than in a stack, so it
          // carries no ring.
          item: 'h-6 w-6 text-[9.5px] border-0',
          remaining: 'h-6 w-6 text-[9.5px] border-0',
        }
      : size === 'sm'
        ? {
            item: 'h-6 w-6 text-[9.5px] border',
            remaining: 'h-6 w-6 text-[9.5px] border',
          }
        : size === 'lg'
          ? {
              item: 'h-[52px] w-[52px] text-[16px] border-2',
              remaining: 'h-[52px] w-[52px] text-[12px] border-2',
            }
          : {
              item: 'h-[30px] w-[30px] text-[10.5px] border-2',
              remaining: 'h-[30px] w-[30px] text-[10px] border-2',
            };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex -space-x-2 items-center">
        {displayUsers.map((user) => (
          <Tooltip key={user._id || user.email || user.fullname || user.fullName}>
            <TooltipTrigger asChild>
              <div
                className={`inline-flex items-center justify-center rounded-full border-background font-bold cursor-help hover:z-10 transition-all hover:scale-110 ${sizeClasses.item} ${getAvatarColor(user.fullname || user.fullName || user.email || '?')}`}
              >
                {user.fullname || user.fullName
                  ? getInitials(user.fullname || user.fullName)
                  : user.email?.[0]?.toUpperCase() || '?'}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-bold text-xs">{capitalizeFirst(user.role || '')}</p>
              <p className="text-[10px] opacity-80">{user.email || 'Unknown email'}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <div
            className={`flex items-center justify-center rounded-full border-background bg-secondary text-secondary-foreground font-bold z-0 ${sizeClasses.remaining}`}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
