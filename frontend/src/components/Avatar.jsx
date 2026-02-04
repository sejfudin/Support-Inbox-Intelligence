import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getInitials } from "@/helpers/getInitials";
import { getAvatarColor } from "@/helpers/avatarColor";
import { capitalizeFirst } from "@/helpers/capitalizeFirst";
export const Avatar = ({ users }) => {
    
  if (!users || users.length === 0) {
    return <span className="text-muted-foreground italic text-xs px-1">Unassigned</span>;
  }
  const maxVisible = 3;
  const displayUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;

  return (
  <TooltipProvider delayDuration={200}>
      <div className="flex -space-x-2 items-center">
        {displayUsers.map((user) => (
          <Tooltip key={user._id}>
            <TooltipTrigger asChild>
              <div className={`inline-flex items-center justify-center h-8 w-8 rounded-full border-2 border-background text-[11px] font-bold cursor-help hover:z-10 transition-all hover:scale-110 ${getAvatarColor(user.fullName || user.email)}`}>
                {user.fullName ? getInitials(user.fullName) : user.email[0].toUpperCase()}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-bold text-xs">{capitalizeFirst(user.role) || "User"}</p>
              <p className="text-[10px] opacity-80">{user.email}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-background bg-secondary text-secondary-foreground text-[10px] font-bold z-0">
            +{remainingCount}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};