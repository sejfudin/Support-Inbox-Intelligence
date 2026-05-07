import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { getInitials } from '@/helpers/getInitials';
import { getAvatarColor } from '@/helpers/avatarColor';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
export const Avatar = ({ users, size = 'md' }) => {
  const safeUsers = (users || []).filter(Boolean);

  if (safeUsers.length === 0) {
    return <span className="text-muted-foreground italic text-xs px-1">Unassigned</span>;
  }
  const maxVisible = 3;
  const displayUsers = safeUsers.slice(0, maxVisible);
  const remainingCount = safeUsers.length - maxVisible;
  const sizeClasses =
    size === 'sm'
      ? {
          item: 'h-5 w-5 text-[10px] border',
          remaining: 'h-5 w-5 text-[10px] border',
        }
      : size === 'lg'
        ? {
            item: 'h-12 w-12 text-[16px] border-2',
            remaining: 'h-12 w-12 text-[12px] border-2',
          }
        : {
            item: 'h-8 w-8 text-[14px] border-2',
            remaining: 'h-8 w-8 text-[10px] border-2',
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
              <p className="font-bold text-xs">{capitalizeFirst(user.role || 'user')}</p>
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
