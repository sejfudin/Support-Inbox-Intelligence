import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
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
import { InternProfileView } from '@/components/interns/InternProfileView';
import { AdminStaffUserDetail } from '@/components/admin/AdminStaffUserDetail';
import UserEditModal from '@/components/UserEditModal';
import { ROLES } from '@/helpers/roles';

function WorkspaceAnalyticsControls({
  analyticsWorkspaces,
  selectedWorkspace,
  onWorkspaceChange,
  days,
  onDaysChange,
}) {
  if (analyticsWorkspaces.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <Select value={selectedWorkspace?.id || ''} onValueChange={onWorkspaceChange}>
        <SelectTrigger
          className="w-full rounded-full border-primary/15 bg-primary/10 text-primary sm:w-[260px]"
          data-test="admin-user-analytics-workspace-select"
        >
          <SelectValue placeholder="Select workspace" />
        </SelectTrigger>
        <SelectContent>
          {analyticsWorkspaces.map((workspace) => (
            <SelectItem
              key={workspace.id}
              value={workspace.id}
              data-test={`admin-user-analytics-workspace-option-${workspace.id}`}
            >
              {workspace.name || 'Workspace'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(days)} onValueChange={(value) => onDaysChange(Number(value))}>
        <SelectTrigger
          className="w-full rounded-full border-primary/15 bg-primary/10 text-primary sm:w-[150px]"
          data-test="admin-user-analytics-period-select"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ANALYTICS_PERIODS.map((period) => (
            <SelectItem
              key={period}
              value={String(period)}
              data-test={`admin-user-analytics-period-option-${period}`}
            >
              Last {period} Days
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function WorkspaceAnalyticsSection({
  analyticsWorkspaces,
  selectedWorkspace,
  onWorkspaceChange,
  days,
  onDaysChange,
  userAnalytics,
  isAnalyticsLoading,
  isAnalyticsError,
}) {
  if (analyticsWorkspaces.length === 0) {
    return (
      <div className="app-panel flex min-h-[180px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Ticket analytics appear once this intern joins an active workspace and starts working on
        assigned tickets.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkspaceAnalyticsControls
        analyticsWorkspaces={analyticsWorkspaces}
        selectedWorkspace={selectedWorkspace}
        onWorkspaceChange={onWorkspaceChange}
        days={days}
        onDaysChange={onDaysChange}
      />

      <PersonalAnalyticsSection
        userAnalytics={userAnalytics}
        isLoading={isAnalyticsLoading}
        isError={isAnalyticsError}
        activityTitle="Activity Trend"
        workloadTitle="Workload Distribution"
        showHeader={false}
      />
    </div>
  );
}

export default function AdminUserAnalyticsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [days, setDays] = useState(30);
  const [editingUser, setEditingUser] = useState(null);

  const { data: loadedUser, isLoading, isError } = useUser(userId);
  const user = loadedUser || location.state?.user;

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

  const analyticsWorkspaces = useMemo(() => {
    if (!user || user.role !== ROLES.INTERN) {
      return [];
    }

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

  const {
    data: userAnalytics,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
  } = useUserAnalytics({
    userId,
    workspaceId: user?.role === ROLES.INTERN ? selectedWorkspace?.id : undefined,
    days,
  });

  const analyticsSection = (
    <WorkspaceAnalyticsSection
      analyticsWorkspaces={analyticsWorkspaces}
      selectedWorkspace={selectedWorkspace}
      onWorkspaceChange={setSelectedWorkspaceId}
      days={days}
      onDaysChange={setDays}
      userAnalytics={userAnalytics}
      isAnalyticsLoading={isAnalyticsLoading}
      isAnalyticsError={isAnalyticsError}
    />
  );

  const editModalUser = user
    ? {
        id: user._id || userId,
        user: user.fullname || user.fullName || '',
        fullName: user.fullname || user.fullName || '',
        email: user.email || '',
        role: user.role || '',
        hub: user.hub?._id || user.hub || '',
        active: user.status === 'active',
      }
    : null;

  const backButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate('/admin/users')}
      className="-ml-2 h-7 px-2 text-muted-foreground"
      data-test="admin-user-analytics-back-button"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back to Users
    </Button>
  );

  const editUserButton = (
    <Button
      type="button"
      variant="outline"
      onClick={() => setEditingUser(editModalUser)}
      data-test="admin-user-analytics-edit-button"
    >
      <Pencil className="mr-2 h-4 w-4" />
      Edit user
    </Button>
  );

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
            Loading user details...
          </div>
        </div>
      </div>
    );
  }

  if (user.role === ROLES.INTERN) {
    return (
      <>
        <InternProfileView
          userId={userId}
          backTo="/admin/users"
          backLabel="Back to users"
          kicker="Intern profile"
          analyticsSection={analyticsSection}
          headingActions={editUserButton}
        />
        {editingUser && <UserEditModal user={editingUser} onClose={() => setEditingUser(null)} />}
      </>
    );
  }

  return (
    <>
      <AdminStaffUserDetail
        user={user}
        userId={userId}
        backButton={backButton}
        editUserButton={editUserButton}
      />
      {editingUser && <UserEditModal user={editingUser} onClose={() => setEditingUser(null)} />}
    </>
  );
}
