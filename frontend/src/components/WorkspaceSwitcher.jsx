import { useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/helpers/roles';
import { useMyWorkspaces, useSwitchWorkspace, useWorkspace } from '@/queries/workspaces';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function WorkspaceLogo({ workspace, size = 'md', className }) {
  const sizeClass =
    size === 'sm'
      ? 'h-6 w-6 rounded-[var(--r-control)]'
      : size === 'lg'
        ? 'h-9 w-9 rounded-[var(--r-card)]'
        : 'h-7 w-7 rounded-[var(--r-control)]';
  const iconClass = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-primary/10 text-primary',
        sizeClass,
        className
      )}
    >
      {workspace?.logoUrl ? (
        <img
          src={workspace.logoUrl}
          alt={workspace.name ? `${workspace.name} logo` : 'Workspace logo'}
          className="h-full w-full object-cover"
        />
      ) : (
        <Building2 className={iconClass} />
      )}
    </span>
  );
}

function WorkspaceLabel({ workspace, subtitle, compact }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-xs font-semibold text-foreground">
        {workspace?.name || 'Workspace'}
      </span>
      {subtitle && !compact ? (
        <span className="block truncate text-[10px] text-muted-foreground">{subtitle}</span>
      ) : null}
    </span>
  );
}

const workspaceFaceClassName =
  'flex h-auto w-full items-center justify-between gap-2 rounded-[var(--r-card)] border border-border/70 bg-card px-3 py-2 text-left shadow-none';

const iconFaceClassName =
  'flex size-8 items-center justify-center rounded-[var(--r-card)] border border-border/70 bg-card p-0 shadow-none';

/**
 * Collapsed-rail workspace marker: the logo inside a static (non-interactive)
 * face with the name in a side tooltip. Used for the no-active-workspace and
 * single-workspace states, where there is nothing to switch between.
 */
function IconWorkspaceFace({ workspace, label, ariaLabel, className }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(iconFaceClassName, className)} aria-label={ariaLabel}>
          <WorkspaceLogo workspace={workspace} size="sm" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function WorkspaceSwitcherFace({ workspace, subtitle, compact, showChevron = false }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <WorkspaceLogo workspace={workspace} />
        <WorkspaceLabel workspace={workspace} subtitle={subtitle} compact={compact} />
      </span>
      {showChevron ? (
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </>
  );
}

/**
 * @param iconOnly Collapsed-sidebar rail: render just the workspace logo as the
 *   trigger. The name and chevron have nowhere to go at 3rem, but hiding the
 *   control entirely would strand an admin in whichever workspace they were last
 *   in, so the dropdown stays reachable.
 */
export default function WorkspaceSwitcher({ className, compact = false, iconOnly = false }) {
  const navigate = useNavigate();
  const { user, refetchUser } = useAuth();
  const { data: activeWorkspace } = useWorkspace(user?.workspaceId);
  const { data: workspaces = [], isLoading } = useMyWorkspaces();
  const switchWorkspace = useSwitchWorkspace();

  const currentId = user?.workspaceId?.toString();
  const activeFromList = workspaces.find((ws) => ws._id?.toString() === currentId);
  const displayWorkspace = activeFromList || activeWorkspace;

  if (!user?.workspaceId) {
    if (iconOnly) {
      // No active workspace ("Global admin mode") — a static marker, matching the
      // non-interactive expanded state.
      return (
        <IconWorkspaceFace
          workspace={displayWorkspace}
          ariaLabel="No active workspace"
          label={
            displayWorkspace?.name || (isAdmin(user?.role) ? 'Global admin mode' : 'Workspace')
          }
          className={className}
        />
      );
    }

    const label = displayWorkspace?.name || (isAdmin(user?.role) ? 'Global admin mode' : null);

    if (!label) return null;

    return (
      <div className={cn(workspaceFaceClassName, className)}>
        <WorkspaceSwitcherFace
          workspace={displayWorkspace || { name: label }}
          subtitle="Workspace"
          compact={compact}
        />
      </div>
    );
  }

  if (workspaces.length <= 1) {
    if (!displayWorkspace?.name && isLoading) return null;

    if (iconOnly) {
      return (
        <IconWorkspaceFace
          workspace={displayWorkspace}
          label={displayWorkspace?.name || 'Workspace'}
          className={className}
        />
      );
    }

    return (
      <div className={cn(workspaceFaceClassName, className)}>
        <WorkspaceSwitcherFace
          workspace={displayWorkspace}
          subtitle="Workspace"
          compact={compact}
        />
      </div>
    );
  }

  const handleSwitch = (workspaceId) => {
    if (workspaceId === currentId) return;

    switchWorkspace.mutate(workspaceId, {
      onSuccess: async () => {
        await refetchUser();
        navigate('/dashboard');
      },
    });
  };

  const trigger = iconOnly ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          data-test="workspace-switcher-trigger"
          className={cn(iconFaceClassName, 'hover:bg-muted/50', className)}
          disabled={isLoading || switchWorkspace.isPending}
          aria-label={`Switch workspace, current: ${displayWorkspace?.name || 'none'}`}
        >
          <WorkspaceLogo workspace={displayWorkspace} size="sm" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{displayWorkspace?.name || 'Switch workspace'}</TooltipContent>
    </Tooltip>
  ) : (
    <Button
      variant="outline"
      size="sm"
      data-test="workspace-switcher-trigger"
      className={cn(workspaceFaceClassName, 'font-normal hover:bg-muted/50', className)}
      disabled={isLoading || switchWorkspace.isPending}
    >
      <WorkspaceSwitcherFace
        workspace={displayWorkspace}
        subtitle="Switch workspace"
        compact={compact}
        showChevron
      />
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={iconOnly ? 'right' : 'bottom'}
        className={iconOnly ? 'w-56' : 'w-[var(--radix-dropdown-menu-trigger-width)]'}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((ws) => {
          const wsId = ws._id?.toString();
          const isActive = wsId === currentId;

          return (
            <DropdownMenuItem
              key={wsId}
              data-test={`workspace-switcher-option-${wsId}`}
              onClick={() => handleSwitch(wsId)}
              className="flex items-center gap-2"
            >
              <WorkspaceLogo workspace={ws} size="sm" />
              <span className="min-w-0 flex-1 truncate">{ws.name}</span>
              {isActive ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
