import { useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
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
import { cn } from '@/lib/utils';

function WorkspaceLogo({ workspace, size = 'md', className }) {
  const sizeClass =
    size === 'sm'
      ? 'h-6 w-6 rounded-md'
      : size === 'lg'
        ? 'h-9 w-9 rounded-xl'
        : 'h-7 w-7 rounded-lg';
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
  'flex h-auto w-full items-center justify-between gap-2 rounded-xl border border-border/70 bg-white/80 px-3 py-2 text-left shadow-none';

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

export default function WorkspaceSwitcher({ className, compact = false }) {
  const navigate = useNavigate();
  const { user, refetchUser } = useAuth();
  const { data: activeWorkspace } = useWorkspace(user?.workspaceId);
  const { data: workspaces = [], isLoading } = useMyWorkspaces();
  const switchWorkspace = useSwitchWorkspace();

  const currentId = user?.workspaceId?.toString();
  const activeFromList = workspaces.find((ws) => ws._id?.toString() === currentId);
  const displayWorkspace = activeFromList || activeWorkspace;

  if (!user?.workspaceId) {
    const label = displayWorkspace?.name || (user?.role === 'admin' ? 'Global admin mode' : null);

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(workspaceFaceClassName, 'font-normal hover:bg-white', className)}
          disabled={isLoading || switchWorkspace.isPending}
        >
          <WorkspaceSwitcherFace
            workspace={displayWorkspace}
            subtitle="Switch workspace"
            compact={compact}
            showChevron
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((ws) => {
          const wsId = ws._id?.toString();
          const isActive = wsId === currentId;

          return (
            <DropdownMenuItem
              key={wsId}
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
