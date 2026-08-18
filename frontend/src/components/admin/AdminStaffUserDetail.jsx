import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeading from '@/components/PageHeading';
import { PageSection, PageShell } from '@/components/PageShell';
import { InternPanel } from '@/components/interns/InternPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useInterns } from '@/queries/interns';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { getRoleLabel, ROLES } from '@/helpers/roles';

function MentorInternsPanel({ mentorUserId }) {
  const { data, isPending, isError } = useInterns({ mentorId: mentorUserId, limit: 50 });
  const interns = data?.interns ?? [];

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading assigned interns...</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-[hsl(var(--tone-danger-fg))]">Failed to load assigned interns.</p>
    );
  }

  if (interns.length === 0) {
    return <p className="text-sm text-muted-foreground">No interns assigned yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/40">
            <TableHead>Intern</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assignment</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {interns.map((intern) => {
            const internUserId = intern.user?._id || intern.user;
            const isPrimary =
              intern.primaryMentor?._id?.toString() === mentorUserId ||
              intern.primaryMentor?.toString() === mentorUserId;

            return (
              <TableRow key={intern._id}>
                <TableCell>
                  <p className="font-medium text-foreground">{intern.user?.fullname}</p>
                  <p className="text-xs text-muted-foreground">{intern.user?.email}</p>
                </TableCell>
                <TableCell>{intern.internshipType?.name || '—'}</TableCell>
                <TableCell className="capitalize">{intern.status}</TableCell>
                <TableCell>{isPrimary ? 'Primary mentor' : 'Secondary mentor'}</TableCell>
                <TableCell className="text-right">
                  <Link
                    to={`/user/${internUserId}`}
                    className="text-sm font-medium text-primary hover:underline"
                    data-test={`staff-user-intern-${internUserId}-link`}
                  >
                    View
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function WorkspaceMembershipsTable({ workspaces, activeWorkspaceId }) {
  if (workspaces.length === 0) {
    return <p className="text-sm text-muted-foreground">Not a member of any workspace yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/40">
            <TableHead>Workspace</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {workspaces.map((workspace) => {
            const workspaceId = String(workspace.id || workspace._id);
            const isActive = workspaceId === activeWorkspaceId;

            return (
              <TableRow key={workspaceId}>
                <TableCell>
                  <p className="font-medium text-foreground">
                    {workspace.name || 'Workspace'}
                    {isActive && (
                      <span className="ml-2 text-xs font-normal text-primary">(active)</span>
                    )}
                  </p>
                </TableCell>
                <TableCell>{capitalizeFirst(workspace.role || 'member')}</TableCell>
                <TableCell>{capitalizeFirst(workspace.status || 'active')}</TableCell>
                <TableCell className="text-muted-foreground">
                  {workspace.joinedAt || workspace.createdAt
                    ? format(new Date(workspace.joinedAt || workspace.createdAt), 'MMM d, yyyy')
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    to={`/admin/workspaces/${workspaceId}`}
                    className="text-sm font-medium text-primary hover:underline"
                    data-test={`staff-user-workspace-${workspaceId}-link`}
                  >
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminStaffUserDetail({ user, userId, backButton, editUserButton }) {
  const userName = user?.fullname || user?.fullName || 'No name';
  const workspaces = user?.workspaces ?? [];
  const activeWorkspaceId = user?.workspaceId ? String(user.workspaceId) : '';
  const activeWorkspace = workspaces.find(
    (workspace) => String(workspace.id || workspace._id) === activeWorkspaceId
  );
  const isMentor = user.role === ROLES.MENTOR;

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          crumb="Admin"
          title={userName}
          subtitle={user?.email}
          beforeTitle={backButton}
          actions={editUserButton}
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--r-card)] border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="font-medium text-foreground">{getRoleLabel(user.role)}</p>
            </div>
            <div className="rounded-[var(--r-card)] border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">
                {capitalizeFirst(user.status || 'active')}
              </p>
            </div>
            <div className="rounded-[var(--r-card)] border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Hub</p>
              <p className="font-medium text-foreground">{user?.hub?.name || '—'}</p>
            </div>
            <div className="rounded-[var(--r-card)] border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Active workspace</p>
              <p className="font-medium text-foreground">
                {activeWorkspace?.name || (activeWorkspaceId ? 'Assigned workspace' : '—')}
              </p>
            </div>
          </div>
        </PageHeading>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList data-test="staff-user-detail-tabs">
            <TabsTrigger value="overview" data-test="staff-user-overview-tab">
              Overview
            </TabsTrigger>
            <TabsTrigger value="workspaces" data-test="staff-user-workspaces-tab">
              Workspaces
            </TabsTrigger>
            {isMentor && (
              <TabsTrigger value="interns" data-test="staff-user-interns-tab">
                Assigned interns
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <InternPanel>
                <h3 className="text-lg font-semibold text-foreground">Account</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="font-medium text-foreground">{user.email || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Hub</dt>
                    <dd className="font-medium text-foreground">
                      {user?.hub?.name
                        ? [user.hub.name, user.hub.city].filter(Boolean).join(', ')
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Member since</dt>
                    <dd className="font-medium text-foreground">
                      {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—'}
                    </dd>
                  </div>
                </dl>
              </InternPanel>

              <InternPanel>
                <h3 className="text-lg font-semibold text-foreground">Workspace access</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Memberships</dt>
                    <dd className="font-medium text-foreground">{workspaces.length}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Active workspace</dt>
                    <dd className="font-medium text-foreground">{activeWorkspace?.name || '—'}</dd>
                  </div>
                  {workspaces.length > 0 && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Latest joined</dt>
                      <dd className="font-medium text-foreground">
                        {format(
                          new Date(
                            Math.max(
                              ...workspaces.map((workspace) =>
                                new Date(workspace.joinedAt || workspace.createdAt || 0).getTime()
                              )
                            )
                          ),
                          'MMM d, yyyy'
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </InternPanel>
            </div>
          </TabsContent>

          <TabsContent value="workspaces">
            <InternPanel>
              <h3 className="text-lg font-semibold text-foreground">Workspace memberships</h3>
              <div className="mt-4">
                <WorkspaceMembershipsTable
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                />
              </div>
            </InternPanel>
          </TabsContent>

          {isMentor && (
            <TabsContent value="interns">
              <InternPanel>
                <h3 className="text-lg font-semibold text-foreground">Assigned interns</h3>
                <div className="mt-4">
                  <MentorInternsPanel mentorUserId={userId} />
                </div>
              </InternPanel>
            </TabsContent>
          )}
        </Tabs>
      </PageSection>
    </PageShell>
  );
}
