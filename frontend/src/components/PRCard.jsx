import React from "react";
import { ExternalLink, RefreshCw, GitPullRequest, GitMerge, GitBranch, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PR_STATE_CONFIG = {
  open: {
    variant: "success",
    icon: GitPullRequest,
    label: "Open",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  closed: {
    variant: "destructive",
    icon: GitPullRequest,
    label: "Closed",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  merged: {
    variant: "default",
    icon: GitMerge,
    label: "Merged",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
};

export function PRCard({ pr, onRefresh, isRefreshing, onUnlink, isUnlinking }) {
  if (!pr) return null;

  const stateConfig = PR_STATE_CONFIG[pr.state] || PR_STATE_CONFIG.open;
  const StateIcon = stateConfig.icon;

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-gray-300">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors overflow-hidden"
          >
            <span className="text-gray-500">#{pr.prNumber}</span>
            <span className="truncate">{pr.prTitle}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-semibold px-2 py-0.5 border flex items-center gap-1",
              stateConfig.className
            )}
          >
            <StateIcon className="w-3 h-3" />
            {stateConfig.label}
          </Badge>
          {pr.isDraft && (
            <Badge
              variant="outline"
              className="text-xs font-semibold px-2 py-0.5 border bg-gray-100 text-gray-600 border-gray-200"
            >
              Draft
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              <span className="font-medium truncate max-w-[150px]">
                {pr.branchName}
              </span>
            </div>

            {pr.author && (
              <div className="flex items-center gap-1.5">
                <img
                  src={pr.author.avatarUrl}
                  alt={pr.author.login}
                  className="w-4 h-4 rounded-full"
                />
                <span className="font-medium">{pr.author.login}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing || isUnlinking}
                className="h-7 w-7 p-0"
                title="Refresh PR status"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
              </Button>
            )}
            {onUnlink && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUnlink}
                disabled={isUnlinking || isRefreshing}
                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                title="Unlink PR"
              >
                <Unlink className={cn("w-3.5 h-3.5", isUnlinking && "animate-pulse")} />
              </Button>
            )}
          </div>
        </div>

        {pr.mergedBy && pr.state === "merged" && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>merged by</span>
            <img
              src={pr.mergedBy.avatarUrl}
              alt={pr.mergedBy.login}
              className="w-4 h-4 rounded-full"
            />
            <span className="font-medium">{pr.mergedBy.login}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PRCard;
