import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Settings, Ticket, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AnalyticsStatCard } from '@/components/analytics/AnalyticsStatCard';
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
import { useAuth } from '@/context/AuthContext';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { CHIP } from '@/helpers/badgeTones';
import { cn } from '@/lib/utils';
import { canDeleteWorkspace, isPlatformAdmin } from '@/helpers/workspacePermissions';
import { ConfirmModal } from '@/components/Modals/ConfirmModal';
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
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { resolveUserId } from '@/helpers/userIdentity';
import { UserAvatar } from '@/components/ui/user-avatar';

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
  useDocumentTitle(workspace?.name);
  const { data: usersData, isLoading: loadingUsers } = useUsers({ pagination: false });
  const { data: ticketsData } = useTickets({ workspaceId: id, limit: 5 }, { enabled: !!id });

  const inviteMember = useInviteWorkspaceMember(id);
  const removeMember = useRemoveWorkspaceMember(id);
  const cancelInvitation = useCancelWorkspaceInvitation(id);
  const switchWorkspace = useSwitchWorkspace();
  const updateWorkspace = useUpdateWorkspace(id);
  const deleteWorkspace = useDeleteWorkspace();

  const currentUserId = resolveUserId(user);
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
  // Only the owner can hand ownership on, and only when there is somebody to hand
  // it to — otherwise the Owner tile offers an action that always fails.
  const canTransferOwnership =
    workspace?.owner?._id?.toString() === currentUserId?.toString() && activeMembers.length > 1;
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

  // The back-link used to be injected into the top header bar. That bar is gone
  // (the bell moved into the sidebar header), so it renders inline above the
  // title instead — see `backLink` below.
  const backLink = (
    <button
      type="button"
      onClick={() => navigate(isPlatformAdmin(user) ? '/admin/workspaces' : '/dashboard')}
      className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      data-test="workspace-detail-back-link"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {isPlatformAdmin(user) ? 'All Workspaces' : 'Dashboard'}
    </button>
  );

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
        <Skeleton className="h-32 w-full rounded-[var(--r-card)]" />
        <Skeleton className="h-80 w-full rounded-[var(--r-card)]" />
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
        {/* The workspace name moves into the subtitle: the page is the same job
            whichever workspace you are in, and a title that changed per workspace
            made the heading answer "where am I" twice — the sidebar's workspace
            switcher already says that. */}
        <PageHeading
          crumb="Workspace"
          beforeTitle={backLink}
          title="Workspace management"
          subtitle={`Members, invitations and settings for ${workspace.name}.`}
          titleAdornment={
            isActiveWorkspace ? (
              <span className={cn(CHIP, 'bg-primary/10 accent-ink')}>Current workspace</span>
            ) : null
          }
          actions={
            <>
              {!isActiveWorkspace && canSwitchToWorkspace && (
                <Button
                  variant="outline"
                  onClick={handleSwitchWorkspace}
                  disabled={switchWorkspace.isPending}
                  data-test="workspace-detail-switch-button"
                >
                  {switchWorkspace.isPending ? 'Switching...' : 'Switch workspace'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate(`/tickets?workspaceId=${id}`)}
                className="gap-2"
                data-test="workspace-detail-view-tickets-button"
              >
                <Ticket className="h-4 w-4" />
                View tickets
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/admin/workspaces/${id}/settings`)}
                className="gap-2"
                data-test="workspace-detail-settings-button"
              >
                <Settings className="h-4 w-4" />
                Workspace settings
              </Button>
              <Button
                onClick={() => setIsInviteOpen(true)}
                className="gap-2"
                data-test="workspace-detail-invite-button"
              >
                <UserPlus className="h-4 w-4" />
                Add existing user
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <AnalyticsStatCard
            label="Active members"
            value={activeMembers.length}
            hint="With access today"
          />
          <AnalyticsStatCard
            label="Pending invites"
            value={pendingInvitations.length}
            hint="Awaiting acceptance"
          />
          <AnalyticsStatCard
            label="Tickets"
            // Not "open": this count is the workspace's whole ticket list, and
            // labelling it "open" would understate it by every closed ticket.
            value={ticketsData?.pagination?.total ?? 0}
            hint="In this workspace"
          />
          <AnalyticsStatCard
            label="Owner"
            value={
              <span className="block truncate">
                {workspace.owner?.fullname || workspace.owner?.email || '—'}
              </span>
            }
            hint={
              canTransferOwnership ? (
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(true)}
                  className="font-semibold accent-ink hover:underline"
                  data-test="workspace-detail-transfer-ownership-button"
                >
                  Transfer available
                </button>
              ) : (
                'Workspace owner'
              )
            }
          />
        </div>

        {/* Members takes the wide column because it is the list you came to act
            on; invitations and the danger zone are a narrow rail beside it, which
            also puts "delete" as far from the member rows as the layout allows. */}
        <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="app-card overflow-hidden">
            <header className="flex items-center justify-between gap-3 border-b border-separator px-[18px] py-3">
              <h2 className="app-card-title">Members</h2>
              <p className="text-[12.5px] text-muted-foreground">People with active access</p>
            </header>

            <ul>
              {activeMembers.length === 0 ? (
                <li className="px-[18px] py-8 text-center text-[12.5px] text-muted-foreground">
                  No active members yet.
                </li>
              ) : (
                activeMembers.map((member) => {
                  const memberUser = member.user;
                  const memberId = memberUser?._id || memberUser;
                  const isOwner = workspace.owner?._id === memberId;
                  const isCurrentUser = memberId?.toString() === currentUserId?.toString();

                  return (
                    <li
                      key={member._id}
                      className="flex flex-wrap items-center gap-3 border-b border-separator px-[18px] py-2.5 transition-colors last:border-b-0 hover:bg-accent/60 sm:flex-nowrap"
                    >
                      <UserAvatar user={memberUser} size="md" showTitle={false} />
                      <div className="min-w-0 flex-1 leading-[1.35]">
                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                          <span className="truncate">{memberUser?.fullname || 'Unnamed user'}</span>
                          {isOwner && (
                            <Crown
                              className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tone-warning))]"
                              aria-label="Workspace owner"
                            />
                          )}
                        </div>
                        <div className="truncate text-[11.5px] text-muted-foreground/75">
                          {memberUser?.email}
                        </div>
                      </div>
                      <RoleBadge role={capitalizeFirst(member.role)} />
                      {!isOwner && !isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member)}
                          disabled={removeMember.isPending}
                          className="h-7 shrink-0 rounded-[var(--r-control)] px-2 text-[12px] text-[hsl(var(--tone-danger-fg))] hover:bg-destructive/10 hover:text-[hsl(var(--tone-danger-fg))]"
                          data-test={`workspace-detail-member-${memberId}-remove-button`}
                        >
                          Remove
                        </Button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <div className="flex flex-col gap-3.5">
            <section className="app-card overflow-hidden">
              <header className="border-b border-separator px-[18px] py-3">
                <h2 className="app-card-title">Pending invitations</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Users who still need to accept.
                </p>
              </header>

              {pendingInvitations.length === 0 ? (
                <p className="m-[18px] rounded-[var(--r-control)] border border-dashed border-border px-3 py-6 text-center text-[11.5px] text-muted-foreground/75">
                  No pending invites.
                </p>
              ) : (
                <ul>
                  {pendingInvitations.map((invitation) => (
                    <li
                      key={invitation._id}
                      className="flex items-center gap-2.5 border-b border-separator px-[18px] py-2.5 last:border-b-0"
                    >
                      <UserAvatar user={invitation.user} size="md" showTitle={false} />
                      <div className="min-w-0 flex-1 leading-[1.35]">
                        <div className="truncate text-[13px] font-medium text-foreground">
                          {invitation.user?.fullname || 'Pending user'}
                        </div>
                        <div className="truncate text-[11.5px] text-muted-foreground/75">
                          {capitalizeFirst(invitation.workspaceRole)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvitation(invitation)}
                        disabled={cancelInvitation.isPending}
                        className="h-7 shrink-0 rounded-[var(--r-control)] px-2 text-[12px] text-[hsl(var(--tone-danger-fg))] hover:bg-destructive/10 hover:text-[hsl(var(--tone-danger-fg))]"
                        data-test={`workspace-detail-invitation-${invitation._id}-cancel-button`}
                      >
                        Cancel
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {canDeleteWorkspace(user, workspace) && (
              // Tinted and outlined in destructive, not a plain card: it is the one
              // irreversible control on the page and it should not look like the
              // panels around it.
              <section className="rounded-[var(--r-card)] border border-destructive/30 bg-destructive/[0.04] p-[18px] pt-[15px]">
                <h2 className="text-[13.5px] font-semibold leading-tight text-[hsl(var(--tone-danger-fg))]">
                  Danger zone
                </h2>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-muted-foreground">
                  Deleting removes access for all members. Workspaces with tickets are archived
                  instead of permanently removed.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteError('');
                    setIsDeleteOpen(true);
                  }}
                  className="mt-3 gap-1.5 border-destructive/40 px-3 text-[12.5px] text-[hsl(var(--tone-danger-fg))] hover:bg-destructive/10 hover:text-[hsl(var(--tone-danger-fg))]"
                  data-test="workspace-detail-delete-button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete workspace
                </Button>
              </section>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
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
              <p className="rounded-[var(--r-control)] border border-[hsl(var(--tone-danger)/0.3)] bg-[hsl(var(--tone-danger)/0.15)] px-3 py-2 text-sm text-[hsl(var(--tone-danger-fg))]">
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
                    className="flex items-center gap-3 rounded-[var(--r-control)] border border-border bg-muted px-3 py-2"
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
                        className="w-28"
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
                      className="text-muted-foreground transition-colors hover:text-[hsl(var(--tone-danger-fg))]"
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
              <p className="rounded-[var(--r-control)] border border-[hsl(var(--tone-danger)/0.3)] bg-[hsl(var(--tone-danger)/0.15)] px-3 py-2 text-sm text-[hsl(var(--tone-danger-fg))]">
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

            <div className="rounded-[var(--r-control)] border border-[hsl(var(--tone-warning)/0.3)] bg-[hsl(var(--tone-warning)/0.15)] px-3 py-2 text-sm text-[hsl(var(--tone-warning-fg))]">
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
