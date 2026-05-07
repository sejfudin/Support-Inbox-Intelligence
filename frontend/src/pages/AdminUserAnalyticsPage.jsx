import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/queries/users';
import { useUserAnalytics } from '@/queries/workspaces';
import PersonalAnalyticsSection from '@/components/PersonalAnalyticsSection';

export default function AdminUserAnalyticsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [days, setDays] = useState(30);

  const { data: loadedUser, isLoading, isError } = useUser(userId);
  const user = location.state?.user || loadedUser;
  const workspaceId = user?.workspaceId;

  const {
    data: userAnalytics,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
  } = useUserAnalytics({
    userId,
    workspaceId,
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

  if (!workspaceId) {
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
                <h1 className="app-title">{user.fullname || 'No name'}</h1>
                <p className="app-subtitle">This user is not assigned to a workspace yet.</p>
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
            Personal analytics are unavailable until this user joins a workspace.
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
              <h1 className="app-title">{user.fullname || 'No name'}</h1>
              <p className="app-subtitle">Personal analytics for this workspace member.</p>
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

        <PersonalAnalyticsSection
          days={days}
          setDays={setDays}
          userAnalytics={userAnalytics}
          isLoading={isAnalyticsLoading}
          isError={isAnalyticsError}
          kicker="User analytics"
          title="Personal Performance"
          description={`Ticket load and completion trend for ${user.fullname || 'this user'}.`}
          periodLabel="Last"
        />
      </div>
    </div>
  );
}