import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Ticket, Building2, Plus, CheckCircle2, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAllWorkspaces,
  useCreateWorkspace,
  useMyWorkspaces,
  useSwitchWorkspace,
  useDeleteWorkspace,
} from '@/queries/workspaces';
import { invalidateWorkspaceScope } from '@/lib/invalidationScopes';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/helpers/roles';
import { canDeleteWorkspace, canManageWorkspace } from '@/helpers/workspacePermissions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/Modals/ConfirmModal';
import { uploadWorkspaceLogo } from '@/api/workspaces';
import {
  WORKSPACE_LOGO_ACCEPT,
  WORKSPACE_LOGO_HELPER_TEXT,
  getWorkspaceLogoValidationError,
} from '@/constants/upload';
import PageHeading from '@/components/PageHeading';
import TicketStatusEditor from '@/components/TicketStatusEditor';
import { DEFAULT_STATUS_DRAFTS } from '@/helpers/ticketStatus';
import { validateStatusDrafts } from '@/helpers/validateStatusDrafts';
import { getApiErrorMessage } from '@/helpers/getApiErrorMessage';
import { resolveUserId } from '@/helpers/userIdentity';

// Role-aware workspaces overview: admins see every workspace in the system,
// mentors/members see the workspaces they belong to. Same cards + create dialog.
export default function WorkspacesOverviewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refetchUser } = useAuth();
  const admin = isAdmin(user?.role);
  const { data: allWorkspaces = [], isLoading: isLoadingAll } = useAllWorkspaces({
    enabled: admin,
  });
  const { data: myWorkspaces = [], isLoading: isLoadingMine } = useMyWorkspaces();
  const workspaces = admin ? allWorkspaces : myWorkspaces;
  const isLoading = admin ? isLoadingAll : isLoadingMine;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [statusDrafts, setStatusDrafts] = useState(DEFAULT_STATUS_DRAFTS);
  const [createError, setCreateError] = useState('');

  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const createWorkspace = useCreateWorkspace();
  const switchWorkspace = useSwitchWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const currentUserId = resolveUserId(user);

  const [logoFile, setLogoFile] = useState(null);

  const validateLogoFile = (file) => {
    const validationError = getWorkspaceLogoValidationError(file);
    if (validationError) {
      setCreateError(validationError);
      return false;
    }
    return true;
  };

  const handleCreate = (e) => {
    e.preventDefault();
    setCreateError('');

    const statusValidation = validateStatusDrafts(statusDrafts);
    if (!statusValidation.valid) {
      setCreateError(statusValidation.message);
      return;
    }

    if (logoFile && !validateLogoFile(logoFile)) return;

    createWorkspace.mutate(
      { name: name.trim(), description: description.trim(), statuses: statusDrafts },
      {
        onSuccess: async (createdWorkspace) => {
          try {
            const workspaceId = createdWorkspace?._id;
            if (logoFile && workspaceId) {
              await uploadWorkspaceLogo(workspaceId, logoFile);
              invalidateWorkspaceScope(queryClient, workspaceId);
            }

            setIsCreateOpen(false);
            setName('');
            setDescription('');
            setStatusDrafts(DEFAULT_STATUS_DRAFTS);
            setLogoFile(null);
          } catch (uploadErr) {
            setCreateError(
              getApiErrorMessage(uploadErr, 'Workspace created, but logo upload failed.')
            );
          }
        },
        onError: (err) => {
          setCreateError(getApiErrorMessage(err, 'Failed to create workspace.'));
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

  // Non-admins can only open management for their active workspace (route
  // guard), so previewing another managed workspace switches to it first.
  const handlePreview = (ws, isActive) => {
    if (admin || isActive) {
      navigate(`/admin/workspaces/${ws._id}`);
      return;
    }
    switchWorkspace.mutate(ws._id, {
      onSuccess: async () => {
        await refetchUser();
        navigate(`/admin/workspaces/${ws._id}`);
      },
    });
  };

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <PageHeading
          crumb={admin ? 'Admin' : 'Mentoring'}
          title={admin ? 'All Workspaces' : 'My Workspaces'}
          subtitle={
            admin
              ? 'Overview of every workspace in the system.'
              : 'Workspaces you own or belong to.'
          }
          actions={
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="w-full gap-2 sm:w-auto"
              data-test="admin-workspaces-new-button"
            >
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
          }
        />

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-[var(--r-card)]" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="app-card flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Building2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {admin
                ? 'No workspaces found.'
                : 'No workspaces yet. Create one to get your team started.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => {
              const isActive = user?.workspaceId?.toString() === ws._id?.toString();
              const canSwitch =
                admin ||
                ws.members?.some(
                  (member) =>
                    member.status === 'active' &&
                    member.user?.toString() === currentUserId?.toString()
                );
              const canManage = admin || canManageWorkspace(user, ws);
              const canDelete = admin || canDeleteWorkspace(user, ws);

              return (
                <div
                  key={ws._id}
                  role={canSwitch && !isActive ? 'button' : undefined}
                  tabIndex={canSwitch && !isActive ? 0 : undefined}
                  data-test={`admin-workspaces-card-${ws._id}-card`}
                  onClick={() => {
                    if (!isActive && canSwitch && !switchWorkspace.isPending) {
                      handleSwitch(ws._id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.key === 'Enter' || event.key === ' ') &&
                      !isActive &&
                      canSwitch &&
                      !switchWorkspace.isPending
                    ) {
                      event.preventDefault();
                      handleSwitch(ws._id);
                    }
                  }}
                  className={`group app-card p-4 text-left transition-colors hover:border-primary/30 ${
                    isActive ? 'border-primary/30 ring-1 ring-primary/30' : ''
                  } ${canSwitch && !isActive ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-[var(--r-tile)] bg-primary/10 text-primary">
                      {ws.logoUrl ? (
                        <img
                          src={ws.logoUrl}
                          alt={`${ws.name} logo`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Building2 className="h-[17px] w-[17px]" />
                      )}
                    </div>
                    {isActive && (
                      <span className="app-chip bg-primary/10 text-primary">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    )}
                  </div>

                  <div className="mb-1">
                    <h2 className="truncate text-[13.5px] font-semibold text-foreground">
                      {ws.name}
                    </h2>
                    {ws.description && (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                        {ws.description}
                      </p>
                    )}
                  </div>

                  <p className="mb-3.5 text-[12px] text-muted-foreground">
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
                      {canManage && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(ws, isActive);
                          }}
                          className="text-xs font-medium text-foreground hover:underline"
                          data-test={`admin-workspaces-card-${ws._id}-preview-link`}
                        >
                          Preview
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteError('');
                            setDeleteTargetId(ws._id);
                          }}
                          className="text-xs font-medium text-[hsl(var(--tone-danger))] hover:text-[hsl(var(--tone-danger-fg))] flex items-center gap-1"
                          data-test={`admin-workspaces-card-${ws._id}-delete-button`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTargetId}
        onClose={() => {
          setDeleteTargetId(null);
          setDeleteError('');
        }}
        onConfirm={() => {
          deleteWorkspace.mutate(deleteTargetId, {
            onSuccess: () => {
              setDeleteTargetId(null);
              setDeleteError('');
            },
            onError: (err) => {
              setDeleteError(err.response?.data?.message || 'Failed to delete workspace.');
            },
          });
        }}
        isLoading={deleteWorkspace.isPending}
        errorMessage={deleteError}
        title="Delete Workspace"
        description="Are you sure you want to delete this workspace? If it has tickets, it will be archived. Otherwise it will be permanently removed."
        confirmLabel="Delete"
        loadingLabel="Deleting..."
      />

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          setCreateError('');
          if (!open) {
            setName('');
            setDescription('');
            setStatusDrafts(DEFAULT_STATUS_DRAFTS);
          }
          setLogoFile(null);
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,840px)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 space-y-2 border-b border-border/60 px-6 py-5 text-left">
            <DialogTitle className="text-xl">Create a new workspace</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Add workspace details and configure the ticket workflow before inviting your team.
            </DialogDescription>
          </DialogHeader>

          <form
            id="create-workspace-form"
            onSubmit={handleCreate}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-5">
              {createError && (
                <p className="rounded-[var(--r-card)] border border-[hsl(var(--tone-danger)/0.3)] bg-[hsl(var(--tone-danger)/0.15)] px-4 py-3 text-sm font-medium text-[hsl(var(--tone-danger-fg))]">
                  {createError}
                </p>
              )}

              <section className="space-y-4">
                <div className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <label htmlFor="admin-workspace-name" className="text-sm font-medium">
                      Workspace name
                    </label>
                    <Input
                      id="admin-workspace-name"
                      placeholder="e.g. Acme Support Team"
                      required
                      className="h-10"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      data-test="admin-workspaces-create-name-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="admin-workspace-description" className="text-sm font-medium">
                      Description{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea
                      id="admin-workspace-description"
                      placeholder="What does this workspace handle?"
                      className="min-h-[88px] resize-y"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={500}
                      data-test="admin-workspaces-create-description-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="admin-workspace-logo" className="text-sm font-medium">
                      Workspace logo{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="admin-workspace-logo"
                      type="file"
                      accept={WORKSPACE_LOGO_ACCEPT}
                      data-test="admin-workspaces-create-logo-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (!file) {
                          setLogoFile(null);
                          return;
                        }
                        if (!validateLogoFile(file)) {
                          e.target.value = '';
                          setLogoFile(null);
                          return;
                        }
                        setLogoFile(file);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">{WORKSPACE_LOGO_HELPER_TEXT}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t border-border/60 pt-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Ticket workflow</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Drag to reorder columns and set backlog, time tracking, and done behavior.
                  </p>
                </div>

                <div className="rounded-[var(--r-card)] border border-border bg-muted/80 p-4 sm:p-5">
                  <TicketStatusEditor
                    items={statusDrafts}
                    onChange={setStatusDrafts}
                    dataTestPrefix="admin-workspaces"
                  />
                </div>
              </section>
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                data-test="admin-workspaces-create-cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createWorkspace.isPending || !name.trim()}
                data-test="admin-workspaces-create-submit-button"
              >
                {createWorkspace.isPending ? 'Creating...' : 'Create workspace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
