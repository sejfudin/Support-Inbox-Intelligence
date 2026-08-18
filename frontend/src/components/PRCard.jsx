import React from 'react';
import { ExternalLink, RefreshCw, GitPullRequest, GitMerge, GitBranch, Unlink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { badgeTone } from '@/helpers/badgeTones';
import { cn } from '@/lib/utils';

export const PR_STATE_CONFIG = {
  open: {
    variant: 'success',
    icon: GitPullRequest,
    label: 'Open',
    className: badgeTone('success'),
  },
  closed: {
    variant: 'destructive',
    icon: GitPullRequest,
    label: 'Closed',
    className: badgeTone('danger'),
  },
  merged: {
    variant: 'default',
    icon: GitMerge,
    label: 'Merged',
    className: badgeTone('violet'),
  },
};

export function PRCard({ pr, onRefresh, isRefreshing, onUnlink, isUnlinking }) {
  if (!pr) return null;

  const stateConfig = PR_STATE_CONFIG[pr.state] || PR_STATE_CONFIG.open;
  const StateIcon = stateConfig.icon;

  return (
    <div className="group relative rounded-[var(--r-card)] border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-border">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-[hsl(var(--tone-info-fg))] transition-colors overflow-hidden"
            data-test={`pr-card-${pr.prNumber}-title-link`}
          >
            <span className="text-muted-foreground">#{pr.prNumber}</span>
            <span className="truncate">{pr.prTitle}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-semibold px-2 py-0.5 border flex items-center gap-1',
              stateConfig.className
            )}
          >
            <StateIcon className="w-3 h-3" />
            {stateConfig.label}
          </Badge>
          {pr.isDraft && (
            <Badge
              variant="outline"
              className="text-xs font-semibold px-2 py-0.5 border bg-muted text-muted-foreground border-border"
            >
              Draft
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              <span className="font-medium truncate max-w-[150px]">{pr.branchName}</span>
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
                data-test={`pr-card-${pr.prNumber}-refresh-button`}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
              </Button>
            )}
            {onUnlink && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUnlink}
                disabled={isUnlinking || isRefreshing}
                className="h-7 w-7 p-0 text-[hsl(var(--tone-danger))] hover:text-[hsl(var(--tone-danger-fg))] hover:bg-[hsl(var(--tone-danger)/0.15)]"
                title="Unlink PR"
                data-test={`pr-card-${pr.prNumber}-unlink-button`}
              >
                <Unlink className={cn('w-3.5 h-3.5', isUnlinking && 'animate-pulse')} />
              </Button>
            )}
          </div>
        </div>

        {pr.mergedBy && pr.state === 'merged' && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
