import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/queries/users';
import { useUserAnalyticsByWorkspaces } from '@/queries/workspaces';
import PersonalAnalyticsSection from '@/components/PersonalAnalyticsSection';

export default function AdminUserAnalyticsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [days, setDays] = useState(30);

  const { data: loadedUser, isLoading, isError } = useUser(userId);
  const user = loadedUser || location.state?.user;
  const userName = user?.fullname || user?.fullName || 'No name';

  const analyticsWorkspaces = useMemo(() => {
    const memberships =
      user?.workspaces
        ?.filter((workspace) => workspace.status === 'active')
        .map((workspace) => ({
          ...workspace,
          id: workspace.id || workspace._id,
        }))
        .filter((workspace) => workspace.id) || [];

    if (memberships.length > 0 || !user?.workspaceId) {
      return memberships;
    }

    return [
      {
        id: user.workspaceId,
        name: 'Assigned Workspace',
        role: 'member',
        status: 'active',
      },
    ];
  }, [user]);

  const analyticsQueries = useUserAnalyticsByWorkspaces({
    userId,
    workspaces: analyticsWorkspaces,
    days,
  });

  if (isError) {
    return (
      <div className="app-page">
        <div className="app-page-content">
          <div className="app-panel flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-destructive">
            Failed to load user details.
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="app-page">
        <div className="app-page-content space-y-6">
          <div className="app-panel flex min-h-[220px] items-center justify-center px-6 text-sm text-muted-foreground">
            Loading user analytics...
          </div>
        </div>
      </div>
    );
  }

  if (analyticsWorkspaces.length === 0) {
    return (
      <div className="app-page">
        <div className="app-page-content space-y-6">
          <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Users
                </Button>
              </div>
              <div>
                <div className="app-kicker mb-3">Admin user analytics</div>
                <h1 className="app-title">{userName}</h1>
                <p className="app-subtitle">
                  This user is not an active member of any workspace yet.
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
                <User className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium text-foreground">{user.role || 'user'}</div>
                  <div>Role</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
                <Mail className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium text-foreground">{user.email}</div>
                  <div>Email</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium text-foreground">{user.status || 'active'}</div>
                  <div>Status</div>
                </div>
              </div>
            </div>
          </div>

          <div className="app-panel flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Personal analytics are unavailable until this user joins an active workspace.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Users
              </Button>
            </div>
            <div>
              <div className="app-kicker mb-3">Admin user analytics</div>
              <h1 className="app-title">{userName}</h1>
              <p className="app-subtitle">
                Personal analytics across {analyticsWorkspaces.length}{' '}
                {analyticsWorkspaces.length === 1 ? 'workspace' : 'workspaces'}.
              </p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
              <User className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium text-foreground">{user.role || 'user'}</div>
                <div>Role</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
              <Mail className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium text-foreground">{user.email}</div>
                <div>Email</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium text-foreground">{user.status || 'active'}</div>
                <div>Status</div>
              </div>
            </div>
          </div>
        </div>

        {analyticsWorkspaces.map((workspace, index) => {
          const analyticsQuery = analyticsQueries[index] || {};
          const workspaceName = workspace.name || 'Workspace';

          return (
            <PersonalAnalyticsSection
              key={workspace.id}
              days={days}
              setDays={setDays}
              userAnalytics={analyticsQuery.data}
              isLoading={analyticsQuery.isLoading}
              isError={analyticsQuery.isError}
              kicker="User analytics"
              title={workspaceName}
              description={`Ticket load and completion trend for ${userName} in ${workspaceName}.`}
              periodLabel="Last"
              activityTitle="Activity Trend"
              workloadTitle="Workload Distribution"
            />
          );
        })}
      </div>
    </div>
  );
}
