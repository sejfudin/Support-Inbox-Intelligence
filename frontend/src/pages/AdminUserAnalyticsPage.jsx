import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/queries/users';
import { useUserAnalytics } from '@/queries/workspaces';
import PersonalAnalyticsSection from '@/components/PersonalAnalyticsSection';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ANALYTICS_PERIODS } from '@/helpers/analyticsFormatters';
import PageHeading from '@/components/PageHeading';

export default function AdminUserAnalyticsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [days, setDays] = useState(30);

  const { data: loadedUser, isLoading, isError } = useUser(userId);
  const user = loadedUser || location.state?.user;
  const userName = user?.fullname || user?.fullName || 'No name';
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

  const analyticsWorkspaces = useMemo(() => {
    const memberships =
      user?.workspaces
        ?.filter((workspace) => workspace.status === 'active')
        .map((workspace) => ({
          ...workspace,
          id: String(workspace.id || workspace._id),
        }))
        .filter((workspace) => workspace.id) || [];

    if (memberships.length > 0 || !user?.workspaceId) {
      return memberships;
    }

    return [
      {
        id: String(user.workspaceId),
        name: 'Assigned Workspace',
        role: 'member',
        status: 'active',
      },
    ];
  }, [user]);

  useEffect(() => {
    if (analyticsWorkspaces.length === 0) {
      setSelectedWorkspaceId('');
      return;
    }

    const stillAvailable = analyticsWorkspaces.some(
      (workspace) => workspace.id === selectedWorkspaceId
    );

    if (!stillAvailable) {
      setSelectedWorkspaceId(analyticsWorkspaces[0].id);
    }
  }, [analyticsWorkspaces, selectedWorkspaceId]);

  const selectedWorkspace =
    analyticsWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId) ||
    analyticsWorkspaces[0];
  const selectedWorkspaceName = selectedWorkspace?.name || 'Workspace';

  const {
    data: userAnalytics,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
  } = useUserAnalytics({
    userId,
    workspaceId: selectedWorkspace?.id,
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

  const userInfoGrid = (
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
  );

  const backButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate('/admin/users')}
      className="-ml-2 h-7 px-2 text-muted-foreground"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back to Users
    </Button>
  );

  if (analyticsWorkspaces.length === 0) {
    return (
      <div className="app-page">
        <div className="app-page-content space-y-6">
          <PageHeading
            kicker="Admin user analytics"
            title={userName}
            subtitle="This user is not an active member of any workspace yet."
            beforeKicker={backButton}
          >
            {userInfoGrid}
          </PageHeading>

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
        <PageHeading
          kicker="Admin user analytics"
          title={userName}
          subtitle={`Viewing personal analytics for ${selectedWorkspaceName}.`}
          beforeKicker={backButton}
        >
          {userInfoGrid}
        </PageHeading>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Select value={selectedWorkspace?.id || ''} onValueChange={setSelectedWorkspaceId}>
            <SelectTrigger className="w-full rounded-full border-primary/15 bg-primary/10 text-primary sm:w-[260px]">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {analyticsWorkspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name || 'Workspace'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger className="w-full rounded-full border-primary/15 bg-primary/10 text-primary sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANALYTICS_PERIODS.map((period) => (
                <SelectItem key={period} value={String(period)}>
                  Last {period} Days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PersonalAnalyticsSection
          userAnalytics={userAnalytics}
          isLoading={isAnalyticsLoading}
          isError={isAnalyticsError}
          activityTitle="Activity Trend"
          workloadTitle="Workload Distribution"
          showHeader={false}
        />
      </div>
    </div>
  );
}
