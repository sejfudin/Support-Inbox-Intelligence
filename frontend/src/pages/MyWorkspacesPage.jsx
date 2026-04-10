import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMyWorkspaces, useSwitchWorkspace } from '@/queries/workspaces';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function MyWorkspacesPage() {
  const navigate = useNavigate();
  const { user, refetchUser } = useAuth();
  const { data: workspaces = [], isLoading } = useMyWorkspaces();
  const switchWorkspace = useSwitchWorkspace();

  const handleSwitch = async (workspaceId) => {
    switchWorkspace.mutate(workspaceId, {
      onSuccess: async () => {
        await refetchUser();
        navigate('/dashboard');
      },
    });
  };

  const currentWorkspaceId = user?.workspaceId?.toString();

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="app-kicker mb-3">Workspace</div>
            <h1 className="app-title">My Workspaces</h1>
            <p className="app-subtitle">
              View and switch between your workspaces.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => {
              const isActive = currentWorkspaceId === ws._id?.toString();

              return (
                <div
                  key={ws._id}
                  className="app-panel flex flex-col justify-between gap-4 p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      {isActive && (
                        <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-lg font-semibold text-foreground">
                      {ws.name}
                    </h3>
                    {ws.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {ws.description}
                      </p>
                    )}

                    <div className="mt-3 text-xs text-muted-foreground">
                      Owner: {ws.owner?.fullname || ws.owner?.email || 'Unknown'}
                    </div>
                  </div>

                  <div className="pt-2">
                    {isActive ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate('/dashboard')}
                      >
                        Go to Dashboard
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleSwitch(ws._id)}
                        disabled={switchWorkspace.isPending}
                      >
                        {switchWorkspace.isPending ? 'Switching...' : 'Switch Workspace'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
