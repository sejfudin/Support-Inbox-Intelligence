import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Crown, Mail, Search, Settings, Ticket, UserMinus, UserPlus, Users } from 'lucide-react';
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
import StatusBadge from '@/components/StatusBadge';
import { RoleBadge } from '@/components/RoleBadge';
import { UserStatusBadge } from '@/components/UserStatusBadge';
import { useAuth } from '@/context/AuthContext';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { useTickets } from '@/queries/tickets';
import { useUsers } from '@/queries/users';
import {
  useInviteWorkspaceMember,
  useRemoveWorkspaceMember,
  useSwitchWorkspace,
  useWorkspace,
} from '@/queries/workspaces';

const initialInviteForm = {
  userId: '',
  role: 'member',
};

export default function WorkspaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refetchUser } = useAuth();
  const { setHeader } = useOutletContext() ?? {};

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(initialInviteForm);
  const [inviteError, setInviteError] = useState('');

  const { data: workspace, isLoading: loadingWorkspace } = useWorkspace(id);
  const { data: usersData, isLoading: loadingUsers } = useUsers({ pagination: false });
  const { data: ticketsData, isLoading: loadingTickets } = useTickets(
    { workspaceId: id, limit: 5 },
    { enabled: !!id }
  );

  const inviteMember = useInviteWorkspaceMember(id);
  const removeMember = useRemoveWorkspaceMember(id);
  const switchWorkspace = useSwitchWorkspace();

  const currentUserId = user?._id || user?.id;
  const tickets = ticketsData?.data ?? [];
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
  ]);
  const availableUsers = allUsers.filter((platformUser) => {
    const platformUserId = platformUser._id?.toString();
    return platformUserId && !unavailableUserIds.has(platformUserId);
  });
  const selectedUser = availableUsers.find((platformUser) => platformUser._id === inviteForm.userId);

  useEffect(() => {
    if (!setHeader) return undefined;

    setHeader(
      <button
        onClick={() => navigate('/admin/workspaces')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Workspaces
      </button>
    );
    return () => setHeader(null);
  }, [setHeader, navigate]);

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    setInviteError('');

    const payload = {
      userId: inviteForm.userId,
      role: inviteForm.role,
    };

    const loadingToast = toast.loading('Saving workspace member...');

    inviteMember.mutate(payload, {
      onSuccess: (result) => {
        toast.dismiss(loadingToast);
        toast.success(result?.message || 'Workspace member saved');
        setInviteForm(initialInviteForm);
        setIsInviteOpen(false);
      },
      onError: (error) => {
        toast.dismiss(loadingToast);
        const message = error.response?.data?.message || 'Failed to save workspace member.';
        setInviteError(message);
        toast.error(message);
      },
    });
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
    return <div className="app-page-content text-center text-muted-foreground">Workspace not found.</div>;
  }

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-primary/10 sm:h-14 sm:w-14 sm:rounded-[1.25rem]">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="app-kicker mb-3">Workspace management</div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-bold text-gray-900">{workspace.name}</h1>
              {isActiveWorkspace && <UserStatusBadge status="active" />}
            </div>
            {workspace.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{workspace.description}</p>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {!isActiveWorkspace && canSwitchToWorkspace && (
            <Button variant="outline" onClick={handleSwitchWorkspace} disabled={switchWorkspace.isPending}>
              {switchWorkspace.isPending ? 'Switching...' : 'Switch Workspace'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/workspaces/${id}/settings`)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Workspace Settings
          </Button>
          <Button variant="outline" onClick={() => navigate(`/tickets?workspaceId=${id}`)} className="gap-2">
            <Ticket className="h-4 w-4" />
            View Tickets
          </Button>
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Existing User
          </Button>
        </div>
      </div>

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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 truncate text-sm font-semibold">
            {workspace.owner?.fullname || workspace.owner?.email || '—'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="app-panel overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Workspace Members</h2>
              </div>
              <p className="text-xs text-muted-foreground">People with active access</p>
            </div>

            <ul className="divide-y">
              {activeMembers.length === 0 ? (
                <li className="px-5 py-4 text-sm text-muted-foreground">No active members yet.</li>
              ) : (
                activeMembers.map((member) => {
                  const memberUser = member.user;
                  const memberId = memberUser?._id || memberUser;
                  const isOwner = workspace.owner?._id === memberId;
                  const isCurrentUser = memberId?.toString() === currentUserId?.toString();

                  return (
                    <li key={member._id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
                      <Avatar users={[memberUser]} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span className="truncate">{memberUser?.fullname || 'Unnamed user'}</span>
                          {isOwner && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{memberUser?.email}</div>
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

            <ul className="divide-y">
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
                      onClick={() => handleRemoveMember({ user: invitation.user })}
                      disabled={removeMember.isPending}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
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

        <section className="app-panel overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Recent Tickets</h2>
            </div>
            <button
              onClick={() => navigate(`/tickets?workspaceId=${id}`)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              See all
            </button>
          </div>

          {loadingTickets ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">No tickets in this workspace yet.</p>
          ) : (
            <ul className="divide-y">
              {tickets.map((ticket) => (
                <li key={ticket._id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{ticket.subject}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {ticket.creator?.fullname || ticket.creator?.email || 'Unknown creator'}
                    </div>
                  </div>
                  <StatusBadge status={ticket.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      </div>

      <Dialog
        open={isInviteOpen}
        onOpenChange={(open) => {
          setIsInviteOpen(open);
          setInviteError('');
          if (!open) {
            setInviteForm(initialInviteForm);
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
              <label className="text-sm font-medium">Registered user</label>
              <Select
                value={inviteForm.userId}
                onValueChange={(value) => setInviteForm((current) => ({ ...current, userId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? 'Loading users...' : 'Choose a registered user'} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <SelectItem value="no-users" disabled>
                      No available platform users
                    </SelectItem>
                  ) : (
                    availableUsers.map((platformUser) => (
                      <SelectItem key={platformUser._id} value={platformUser._id}>
                        {platformUser.fullname} ({platformUser.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedUser && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <Search className="h-4 w-4 text-slate-500" />
                    {selectedUser.fullname}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{selectedUser.email}</div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Workspace role</label>
              <Select
                value={inviteForm.role}
                onValueChange={(value) => setInviteForm((current) => ({ ...current, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">What happens next</label>
              <Textarea
                readOnly
                value="Only existing platform users can be invited from this screen. To create a brand new account and place them into a workspace, use All Users and assign a workspace during user creation."
                className="min-h-[92px] resize-none bg-slate-50 text-sm text-muted-foreground"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={inviteMember.isPending || !inviteForm.userId}
              >
                {inviteMember.isPending ? 'Saving...' : 'Save Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
