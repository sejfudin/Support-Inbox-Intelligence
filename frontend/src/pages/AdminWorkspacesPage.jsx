import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useEffect } from 'react';
import { Users, Ticket, ArrowRight, Building2, Plus, CheckCircle2 } from 'lucide-react';
import { useAllWorkspaces, useCreateWorkspace, useSwitchWorkspace } from '@/queries/workspaces';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function AdminWorkspacesPage() {
  const { setHeader } = useOutletContext() ?? {};
  const navigate = useNavigate();
  const { user, refetchUser } = useAuth();
  const { data: workspaces = [], isLoading } = useAllWorkspaces();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState('');

  const createWorkspace = useCreateWorkspace();
  const switchWorkspace = useSwitchWorkspace();
  const currentUserId = user?._id || user?.id;

  useEffect(() => {
    if (!setHeader) return undefined;
    setHeader(<span className="font-semibold text-sm">All Workspaces</span>);
    return () => setHeader(null);
  }, [setHeader]);

  const handleCreate = (e) => {
    e.preventDefault();
    setCreateError('');
    createWorkspace.mutate(
      { name: name.trim(), description: description.trim() },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setName('');
          setDescription('');
        },
        onError: (err) => {
          setCreateError(err.response?.data?.message || 'Failed to create workspace.');
        },
      }
    );
  };

  const handleSwitch = async (workspaceId) => {
    switchWorkspace.mutate(workspaceId, {
      onSuccess: async () => {
        await refetchUser();
        navigate('/dashboard');
      },
    });
  };

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="app-kicker mb-3">Admin overview</div>
            <h1 className="app-title">All Workspaces</h1>
            <p className="app-subtitle">
            Overview of every workspace in the system.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            New Workspace
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="app-panel flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Building2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">No workspaces found.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => {
            const isActive = user?.workspaceId?.toString() === ws._id?.toString();
            const canSwitch = user?.role === 'admin' || ws.members?.some(
              (member) =>
                member.status === 'active' &&
                member.user?.toString() === currentUserId?.toString()
            );

            return (
              <div
                key={ws._id}
                role={canSwitch && !isActive ? 'button' : undefined}
                tabIndex={canSwitch && !isActive ? 0 : undefined}
                onClick={() => {
                  if (!isActive && canSwitch && !switchWorkspace.isPending) {
                    handleSwitch(ws._id);
                  }
                }}
                onKeyDown={(event) => {
                  if ((event.key === 'Enter' || event.key === ' ') && !isActive && canSwitch && !switchWorkspace.isPending) {
                    event.preventDefault();
                    handleSwitch(ws._id);
                  }
                }}
                className={`group rounded-[1.5rem] border border-white/70 bg-gradient-to-br from-white via-white to-primary/5 p-5 text-left shadow-[0_18px_50px_-28px_rgba(76,81,191,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_22px_50px_-24px_rgba(76,81,191,0.5)] ${
                  isActive ? 'ring-2 ring-primary/40 border-primary/30' : ''
                } ${
                  canSwitch && !isActive ? 'cursor-pointer' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  {isActive && (
                    <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </span>
                  )}
                </div>

                <div className="mb-1">
                  <h2 className="truncate font-semibold text-gray-900">{ws.name}</h2>
                  {ws.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {ws.description}
                    </p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                  Owner: {ws.owner?.fullname || ws.owner?.email || '—'}
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{ws.activeMemberCount ?? 0} members</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Ticket className="h-3.5 w-3.5" />
                      <span>{ws.ticketCount ?? 0} tickets</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/workspaces/${ws._id}`);
                      }}
                      className="text-xs font-medium text-slate-700 hover:underline"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); setCreateError(''); }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md sm:w-full">
          <DialogHeader>
            <DialogTitle>Create a new workspace</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 py-2">
            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {createError}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Workspace name</label>
              <Input
                placeholder="e.g. Acme Support Team"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="What does this workspace handle?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createWorkspace.isPending || !name.trim()}>
                {createWorkspace.isPending ? 'Creating...' : 'Create Workspace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
