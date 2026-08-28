import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquarePlus, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader, useLoaderHold } from '@/components/ui/loader';
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
import { SendMentorNoteModal } from '@/components/SendMentorNoteModal';
import { ROLES } from '@/helpers/roles';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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
      <div className="app-card flex min-h-[180px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Ticket analytics appear once this intern joins an active workspace and starts working on
        assigned tickets.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
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
        // `days` was missing here: the query already varied with the period
        // selector above, but the tiles kept claiming "Last 30 days" whatever it
        // was set to.
        days={days}
        activityTitle="Activity trend"
        workloadTitle="Workload distribution"
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
  const [sendingNote, setSendingNote] = useState(false);

  const { data: loadedUser, isLoading: isLoadingRaw, isError } = useUser(userId);
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isLoading = useLoaderHold(isLoadingRaw, { release: isError });
  const user = loadedUser || location.state?.user;
  useDocumentTitle(user?.fullname || user?.fullName);

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
    <div className="flex items-center gap-2">
      {/* `user` can still be undefined here — this is built before the
          `isLoading || !user` guard below returns. */}
      {user?.role === ROLES.MENTOR && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setSendingNote(true)}
          data-test="admin-user-analytics-send-note-button"
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Send a note
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() => setEditingUser(editModalUser)}
        data-test="admin-user-analytics-edit-button"
      >
        <Pencil className="mr-2 h-4 w-4" />
        Edit user
      </Button>
    </div>
  );

  if (isError) {
    return (
      <div className="app-page">
        <div className="app-page-content">
          <div className="app-card flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-[hsl(var(--tone-danger-fg))]">
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
          {/* The page branches on the user's role once it arrives — an intern gets the whole
              `InternProfileView`, a staff account a different layout entirely — so there is no
              shape to stand in for. The card keeps its 220px so the page doesn't grow under the
              loader. */}
          <div className="app-card flex min-h-[220px] items-center justify-center px-6">
            <Loader label="Loading user details…" />
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
      <SendMentorNoteModal
        open={sendingNote}
        onClose={() => setSendingNote(false)}
        targetUserId={user._id || userId}
        targetName={user.fullname || user.fullName}
      />
    </>
  );
}
