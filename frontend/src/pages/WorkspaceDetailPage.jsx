import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Crown,
  Mail,
  Settings,
  Ticket,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { RoleBadge } from '@/components/RoleBadge';
import { UserStatusBadge } from '@/components/UserStatusBadge';
import { useAuth } from '@/context/AuthContext';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { canDeleteWorkspace, isPlatformAdmin } from '@/helpers/workspacePermissions';
import { DeleteConfirmModal } from '@/components/Modals/DeleteConfirmModal';
import { useTickets } from '@/queries/tickets';
import { useUsers } from '@/queries/users';
import {
  useCancelWorkspaceInvitation,
  useDeleteWorkspace,
  useInviteWorkspaceMember,
  useRemoveWorkspaceMember,
  useSwitchWorkspace,
  useUpdateWorkspace,
  useWorkspace,
} from '@/queries/workspaces';
import PageHeading from '@/components/PageHeading';

export default function WorkspaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refetchUser } = useAuth();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState([]);
  const [inviteError, setInviteError] = useState('');
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { data: workspace, isLoading: loadingWorkspace } = useWorkspace(id);
  const { data: usersData, isLoading: loadingUsers } = useUsers({ pagination: false });
  const { data: ticketsData } = useTickets({ workspaceId: id, limit: 5 }, { enabled: !!id });

  const inviteMember = useInviteWorkspaceMember(id);
  const removeMember = useRemoveWorkspaceMember(id);
  const cancelInvitation = useCancelWorkspaceInvitation(id);
  const switchWorkspace = useSwitchWorkspace();
  const updateWorkspace = useUpdateWorkspace(id);
  const deleteWorkspace = useDeleteWorkspace();

  const currentUserId = user?._id || user?.id;
  const allUsers = usersData?.users ?? [];

  const members = workspace?.members ?? [];
  const pendingInvitations = workspace?.pendingInvitations ?? [];
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members]
  );
  const isActiveWorkspace = user?.workspaceId?.toString() === id?.toString();
  const canSwitchToWorkspace = activeMembers.some(
    (member) => (member.user?._id || member.user)?.toString() === currentUserId?.toString()
  );
  const unavailableUserIds = new Set([
    ...members.map((member) => (member.user?._id || member.user)?.toString()),
    ...pendingInvitations.map((invitation) => invitation.user?._id?.toString()),
    // already queued for this batch
    ...inviteForm.map((invite) => invite.user._id?.toString()),
  ]);
  const availableUsers = allUsers.filter((platformUser) => {
    const platformUserId = platformUser._id?.toString();
    return platformUserId && !unavailableUserIds.has(platformUserId);
  });

  // Queue a picked user for invitation (default role member). No-op if already queued.
  const handleAddInvite = (platformUser) => {
    setInviteForm((current) =>
      current.some((invite) => invite.user._id === platformUser._id)
        ? current
        : [...current, { user: platformUser, role: 'member' }]
    );
  };

  const handleInviteRoleChange = (userId, role) => {
    setInviteForm((current) =>
      current.map((invite) => (invite.user._id === userId ? { ...invite, role } : invite))
    );
  };

  const handleRemoveInvite = (userId) => {
    setInviteForm((current) => current.filter((invite) => invite.user._id !== userId));
  };

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    setInviteError('');

    if (inviteForm.length === 0) return;

    const invites = inviteForm.map((invite) => ({
      userId: invite.user._id,
      role: invite.role,
    }));

    const loadingToast = toast.loading('Saving workspace members...');

    inviteMember.mutate(
      { invites },
      {
        onSuccess: (result) => {
          toast.dismiss(loadingToast);

          const results = result?.results ?? [];
          const failures = results.filter((entry) => entry.status === 'failed');
          const invited = results.length - failures.length;

          // Surface any per-user failures (already a member, pending invite, etc.)
          failures.forEach((entry) => {
            const name =
              inviteForm.find((invite) => invite.user._id === entry.userId)?.user.fullname ||
              'A user';
            toast.error(`${name}: ${entry.message}`);
          });

          if (invited > 0) {
            toast.success(result?.message || 'Workspace members saved');
          }

          if (failures.length === 0) {
            setInviteForm([]);
            setIsInviteOpen(false);
          } else {
            // Keep the ones that failed queued so the user can review/remove them.
            const failedIds = new Set(failures.map((entry) => entry.userId));
            setInviteForm((current) => current.filter((invite) => failedIds.has(invite.user._id)));
          }
        },
        onError: (error) => {
          toast.dismiss(loadingToast);
          const message = error.response?.data?.message || 'Failed to save workspace members.';
          setInviteError(message);
          toast.error(message);
        },
      }
    );
  };

  const handleRemoveMember = (member) => {
    const memberId = member.user?._id || member.user;
    const memberName = member.user?.fullname || member.user?.email || 'this member';
    const loadingToast = toast.loading(`Removing ${memberName}...`);

    removeMember.mutate(memberId, {
      onSuccess: () => {
        toast.dismiss(loadingToast);
        toast.success(`${memberName} removed from workspace`);
      },
      onError: (error) => {
        toast.dismiss(loadingToast);
        toast.error(error.response?.data?.message || 'Failed to remove workspace member.');
      },
    });
  };

  const handleCancelInvitation = (invitation) => {
    const inviteeName = invitation.user?.fullname || invitation.user?.email || 'this invitation';
    const loadingToast = toast.loading(`Cancelling invitation for ${inviteeName}...`);

    cancelInvitation.mutate(invitation._id, {
      onSuccess: () => {
        toast.dismiss(loadingToast);
        toast.success('Invitation cancelled');
      },
      onError: (error) => {
        toast.dismiss(loadingToast);
        toast.error(error.response?.data?.message || 'Failed to cancel invitation.');
      },
    });
  };

  const handleDeleteWorkspace = () => {
    deleteWorkspace.mutate(id, {
      onSuccess: async () => {
        setIsDeleteOpen(false);
        setDeleteError('');
        toast.success('Workspace deleted');
        await refetchUser();
        navigate(isPlatformAdmin(user) ? '/admin/workspaces' : '/');
      },
      onError: (error) => {
        setDeleteError(error.response?.data?.message || 'Failed to delete workspace.');
      },
    });
  };

  const handleSwitchWorkspace = () => {
    if (!id) return;

    switchWorkspace.mutate(id, {
      onSuccess: async () => {
        await refetchUser();
        toast.success('Workspace switched');
        navigate('/workspace');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to switch workspace.');
      },
    });
  };

  if (loadingWorkspace) {
    return (
      <div className="app-page-content space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="app-page-content text-center text-muted-foreground">Workspace not found.</div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <button
          type="button"
          onClick={() => navigate(isPlatformAdmin(user) ? '/admin/workspaces' : '/dashboard')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-test="workspace-detail-back-link"
        >
          <ArrowLeft className="h-4 w-4" />
          {isPlatformAdmin(user) ? 'All Workspaces' : 'Dashboard'}
        </button>

        <PageHeading
          kicker="Workspace management"
          title={
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                {workspace?.logoUrl ? (
                  <img
                    src={workspace.logoUrl}
                    alt={`${workspace.name} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-4 w-4 text-primary" />
                )}
              </span>
              <span>{workspace.name}</span>
            </span>
          }
          subtitle={
            workspace.description || 'Manage members, invitations, and access for this workspace.'
          }
          titleAdornment={isActiveWorkspace ? <UserStatusBadge status="active" /> : null}
          actions={
            <>
              {!isActiveWorkspace && canSwitchToWorkspace && (
                <Button
                  variant="outline"
                  onClick={handleSwitchWorkspace}
                  disabled={switchWorkspace.isPending}
                  data-test="workspace-detail-switch-button"
                >
                  {switchWorkspace.isPending ? 'Switching...' : 'Switch Workspace'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate(`/admin/workspaces/${id}/settings`)}
                className="gap-2"
                data-test="workspace-detail-settings-button"
              >
                <Settings className="h-4 w-4" />
                Workspace Settings
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/tickets?workspaceId=${id}`)}
                className="gap-2"
                data-test="workspace-detail-view-tickets-button"
              >
                <Ticket className="h-4 w-4" />
                View Tickets
              </Button>
              <Button
                onClick={() => setIsInviteOpen(true)}
                className="gap-2"
                data-test="workspace-detail-invite-button"
              >
                <UserPlus className="h-4 w-4" />
                Add Existing User
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="app-panel-soft p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Members</p>
            <p className="mt-1 text-2xl font-bold">{activeMembers.length}</p>
          </div>
          <div className="app-panel-soft p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Invites</p>
            <p className="mt-1 text-2xl font-bold">{pendingInvitations.length}</p>
          </div>
          <div className="app-panel-soft p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Open Tickets</p>
            <p className="mt-1 text-2xl font-bold">{ticketsData?.pagination?.total ?? 0}</p>
          </div>
          <div className="app-panel-soft p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
              {workspace.owner?._id?.toString() === currentUserId?.toString() &&
                activeMembers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsTransferOpen(true)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                    data-test="workspace-detail-transfer-ownership-button"
                  >
                    Transfer
                  </button>
                )}
            </div>
            <p className="mt-1 truncate text-sm font-semibold">
              {workspace.owner?.fullname || workspace.owner?.email || '—'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="app-panel overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Workspace Members</h2>
              </div>
              <p className="text-xs text-muted-foreground">People with active access</p>
            </div>

            <ul className="divide-y divide-separator">
              {activeMembers.length === 0 ? (
                <li className="px-5 py-4 text-sm text-muted-foreground">No active members yet.</li>
              ) : (
                activeMembers.map((member) => {
                  const memberUser = member.user;
                  const memberId = memberUser?._id || memberUser;
                  const isOwner = workspace.owner?._id === memberId;
                  const isCurrentUser = memberId?.toString() === currentUserId?.toString();

                  return (
                    <li
                      key={member._id}
                      className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap"
                    >
                      <Avatar users={[memberUser]} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span className="truncate">{memberUser?.fullname || 'Unnamed user'}</span>
                          {isOwner && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {memberUser?.email}
                        </div>
                      </div>
                      <div className="hidden shrink-0 md:block">
                        <RoleBadge role={capitalizeFirst(member.role)} />
                      </div>
                      {!isOwner && !isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member)}
                          disabled={removeMember.isPending}
                          className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
                          data-test={`workspace-detail-member-${memberId}-remove-button`}
                        >
                          <UserMinus className="h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="app-panel overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Pending Invitations</h2>
              </div>
              <p className="text-xs text-muted-foreground">Users who still need to accept</p>
            </div>

            <ul className="divide-y divide-separator">
              {pendingInvitations.length === 0 ? (
                <li className="px-5 py-4 text-sm text-muted-foreground">No pending invites.</li>
              ) : (
                pendingInvitations.map((invitation) => (
                  <li key={invitation._id} className="flex items-center gap-3 px-5 py-4">
                    <Avatar users={[invitation.user]} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {invitation.user?.fullname || 'Pending user'}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {invitation.user?.email}
                      </div>
                    </div>
                    <div className="hidden shrink-0 md:block">
                      <RoleBadge role={capitalizeFirst(invitation.workspaceRole)} />
                    </div>
                    <div className="hidden shrink-0 md:block">
                      <UserStatusBadge status="invited" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvitation(invitation)}
                      disabled={cancelInvitation.isPending}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      data-test={`workspace-detail-invitation-${invitation._id}-cancel-button`}
                    >
                      <UserMinus className="h-4 w-4" />
                      Cancel
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        {canDeleteWorkspace(user, workspace) && (
          <section className="app-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-red-600">Danger zone</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Deleting removes access for all members. Workspaces with tickets are archived
                  instead of permanently removed.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteError('');
                  setIsDeleteOpen(true);
                }}
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                data-test="workspace-detail-delete-button"
              >
                <Trash2 className="h-4 w-4" />
                Delete Workspace
              </Button>
            </div>
          </section>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeleteError('');
        }}
        onConfirm={handleDeleteWorkspace}
        isLoading={deleteWorkspace.isPending}
        errorMessage={deleteError}
        title="Delete Workspace"
        description="Are you sure you want to delete this workspace? If it has tickets, it will be archived. Otherwise it will be permanently removed."
        confirmLabel="Delete"
        loadingLabel="Deleting..."
      />

      <Dialog
        open={isInviteOpen}
        onOpenChange={(open) => {
          setIsInviteOpen(open);
          setInviteError('');
          if (!open) {
            setInviteForm([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add or invite a workspace member</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4">
            {inviteError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {inviteError}
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="workspace-detail-invite-user" className="text-sm font-medium">
                Registered users
              </label>
              <SearchableSelect
                items={availableUsers}
                onSelect={handleAddInvite}
                filter={(platformUser, q) =>
                  `${platformUser.fullname} ${platformUser.email}`.toLowerCase().includes(q)
                }
                renderItem={(platformUser) => (
                  <span>
                    <span className="font-medium">{platformUser.fullname}</span>{' '}
                    <span className="text-muted-foreground">({platformUser.email})</span>
                  </span>
                )}
                getItemDataTest={(platformUser) =>
                  `workspace-detail-invite-user-option-${platformUser._id}`
                }
                placeholder={
                  loadingUsers ? 'Loading users...' : 'Search a registered user by name or email'
                }
                emptyMessage="No available platform users"
                disabled={loadingUsers}
                id="workspace-detail-invite-user"
                dataTest="workspace-detail-invite-user-select"
              />
            </div>

            {inviteForm.length > 0 && (
              <ul className="space-y-2" data-test="workspace-detail-invite-selected-list">
                {inviteForm.map(({ user: invitee, role }) => (
                  <li
                    key={invitee._id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2"
                    data-test={`workspace-detail-invite-selected-${invitee._id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {invitee.fullname}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{invitee.email}</div>
                    </div>
                    <Select
                      value={role}
                      onValueChange={(value) => handleInviteRoleChange(invitee._id, value)}
                    >
                      <SelectTrigger
                        className="h-8 w-28"
                        data-test={`workspace-detail-invite-selected-${invitee._id}-role`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => handleRemoveInvite(invitee._id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Remove ${invitee.fullname}`}
                      data-test={`workspace-detail-invite-selected-${invitee._id}-remove`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">What happens next</label>
              <Textarea
                readOnly
                value="Only existing platform users can be invited from this screen. To create a brand new account and place them into a workspace, use All Users and assign a workspace during user creation."
                className="min-h-[92px] resize-none bg-muted text-sm text-muted-foreground"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteOpen(false)}
                data-test="workspace-detail-invite-cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={inviteMember.isPending || inviteForm.length === 0}
                data-test="workspace-detail-invite-submit-button"
              >
                {inviteMember.isPending
                  ? 'Saving...'
                  : inviteForm.length > 1
                    ? `Save ${inviteForm.length} members`
                    : 'Save member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTransferOpen}
        onOpenChange={(open) => {
          setIsTransferOpen(open);
          setTransferError('');
          if (!open) {
            setSelectedNewOwner('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Workspace Ownership</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setTransferError('');

              if (!selectedNewOwner) {
                setTransferError('Please select a new owner');
                return;
              }

              const newOwner = activeMembers.find(
                (m) => (m.user?._id || m.user)?.toString() === selectedNewOwner
              )?.user;

              if (!newOwner) {
                setTransferError('Selected user not found');
                return;
              }

              const loadingToast = toast.loading('Transferring ownership...');

              updateWorkspace.mutate(
                { owner: selectedNewOwner },
                {
                  onSuccess: () => {
                    toast.dismiss(loadingToast);
                    toast.success(
                      `Workspace ownership transferred to ${newOwner.fullname || newOwner.email}`
                    );
                    setIsTransferOpen(false);
                    setSelectedNewOwner('');
                  },
                  onError: (error) => {
                    toast.dismiss(loadingToast);
                    const message = error.response?.data?.message || 'Failed to transfer ownership';
                    setTransferError(message);
                    toast.error(message);
                  },
                }
              );
            }}
            className="space-y-4"
          >
            {transferError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {transferError}
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="workspace-detail-transfer-owner" className="text-sm font-medium">
                New Owner
              </label>
              <Select
                value={selectedNewOwner}
                onValueChange={(value) => setSelectedNewOwner(value)}
              >
                <SelectTrigger
                  id="workspace-detail-transfer-owner"
                  data-test="workspace-detail-transfer-owner-select"
                >
                  <SelectValue placeholder="Select a new owner" />
                </SelectTrigger>
                <SelectContent>
                  {activeMembers.filter((m) => {
                    const memberId = (m.user?._id || m.user)?.toString();
                    return memberId !== workspace.owner?._id?.toString();
                  }).length === 0 ? (
                    <SelectItem
                      value="no-members"
                      disabled
                      data-test="workspace-detail-transfer-owner-option-empty"
                    >
                      No eligible members found
                    </SelectItem>
                  ) : (
                    activeMembers
                      .filter((m) => {
                        const memberId = (m.user?._id || m.user)?.toString();
                        return memberId !== workspace.owner?._id?.toString();
                      })
                      .map((member) => {
                        const memberUser = member.user;
                        const memberId = memberUser?._id || memberUser;
                        return (
                          <SelectItem
                            key={memberId}
                            value={memberId?.toString()}
                            data-test={`workspace-detail-transfer-owner-option-${memberId}`}
                          >
                            {memberUser?.fullname || 'Unnamed'} ({memberUser?.email})
                          </SelectItem>
                        );
                      })
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">Warning</p>
              <p className="mt-1">
                Transferring ownership will give full control of this workspace to the selected
                user.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransferOpen(false)}
                data-test="workspace-detail-transfer-cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateWorkspace.isPending || !selectedNewOwner}
                data-test="workspace-detail-transfer-submit-button"
              >
                {updateWorkspace.isPending ? 'Transferring...' : 'Transfer Ownership'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
