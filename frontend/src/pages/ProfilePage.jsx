import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { InternSelfServicePanel } from '@/components/interns/InternSelfServicePanel';
import { ChangePasswordPanel } from '@/components/profile/ChangePasswordPanel';
import { ProfileActivityPanel } from '@/components/profile/ProfileActivityPanel';
import { ProfileIdentityCard } from '@/components/profile/ProfileIdentityCard';
import { ProfileMetaCard } from '@/components/profile/ProfileMetaCard';
import { ProfileStatRow } from '@/components/profile/ProfileStatRow';
import { useAuth } from '@/context/AuthContext';
import { useUpdateUser } from '@/queries/auth';
import { useMyAttendance } from '@/queries/attendance';
import { useMyAbsenceRequests } from '@/queries/absenceRequests';
import { useMyTickets } from '@/queries/tickets';
import { useMyWorkspaces, useUserAnalytics } from '@/queries/workspaces';
import { buildProfileActivity } from '@/helpers/profileActivity';
import { getRoleLabel, isIntern as isInternRole } from '@/helpers/roles';
import { resolveUserId } from '@/helpers/userIdentity';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

// Enough recent tickets to fill the activity feed after the window drops the
// stale ones, without pulling a page the card can never show.
const ACTIVITY_TICKET_LIMIT = 10;
const ANALYTICS_DAYS = 30;

const formatDay = (value) => (value ? format(new Date(value), 'MMM d, yyyy') : null);

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);

  const { user, loading, refetchUser } = useAuth();
  const updateUserMutation = useUpdateUser();

  const [draftProfile, setDraftProfile] = useState({ fullName: '' });

  const userId = resolveUserId(user);
  const workspaceId = user?.workspaceId;
  const isIntern = isInternRole(user?.role);

  const { data: analytics, isLoading: isAnalyticsLoading } = useUserAnalytics({
    userId,
    workspaceId,
    days: ANALYTICS_DAYS,
  });

  // Attendance and absence requests are intern-only endpoints — asking for them
  // as an admin is a guaranteed 403, not an empty list.
  const { data: attendance, isLoading: isAttendanceLoading } = useMyAttendance({
    enabled: isIntern,
  });
  const { data: absenceRequests } = useMyAbsenceRequests({ enabled: isIntern });

  const { data: myTickets, isLoading: isTicketsLoading } = useMyTickets(
    { limit: ACTIVITY_TICKET_LIMIT },
    { enabled: !!workspaceId }
  );

  const { data: workspaces = [] } = useMyWorkspaces();

  const activity = useMemo(
    () =>
      buildProfileActivity({
        tickets: myTickets?.data || [],
        records: attendance?.records || [],
        requests: absenceRequests?.requests || [],
        hubName: user?.hub?.name || '',
      }),
    [myTickets, attendance, absenceRequests, user]
  );

  const accountRows = useMemo(() => {
    const currentId = workspaceId?.toString();
    const activeWorkspace = workspaces.find((ws) => ws._id?.toString() === currentId);

    return [
      { label: 'Member since', value: formatDay(user?.createdAt) },
      { label: 'Role', value: getRoleLabel(user?.role) },
      {
        label: 'Workspaces',
        value: workspaces.length
          ? [workspaces.length, activeWorkspace?.name].filter(Boolean).join(' · ')
          : null,
      },
      { label: 'Password set', value: formatDay(user?.passwordSetAt) },
    ];
  }, [user, workspaces, workspaceId]);

  const handleSave = (e) => {
    e.preventDefault();

    updateUserMutation.mutate(
      { id: userId, data: { fullname: draftProfile.fullName } },
      {
        onSuccess: () => {
          setIsEditing(false);
          setDraftProfile({ fullName: '' });
          refetchUser();
          toast.success('Profile updated', {
            description: 'Your information has been successfully saved.',
          });
        },
      }
    );
  };

  if (loading)
    return (
      <LoadingOverlay label="Loading profile">
        <TableSkeleton />
      </LoadingOverlay>
    );
  if (!user)
    return (
      <div className="flex h-[var(--app-vh)] items-center justify-center text-[hsl(var(--tone-danger))]">
        Error Loading User Profile.
      </div>
    );

  const profile = {
    fullName: isEditing ? draftProfile.fullName : user.fullname || '',
    email: user.email || '',
  };

  const isFullNameValid = profile.fullName.trim().length > 0;

  return (
    <PageShell>
      {/* No inner width cap. `PageSection` already carries the app-wide
          `max-w-[112rem] px-6`, and this page used to narrow itself to `max-w-3xl`
          on top of that — which left Profile floating in a 768px column while every
          neighbouring page ran full width. It also broke the header band: bleeding
          `.app-page-header` out by `-mx-6` only lines up when the heading sits
          directly in the section's gutter, so inside the capped div the band was
          pulled past its own container on both sides. */}
      <PageSection className="space-y-3.5">
        <PageHeading
          crumb="Account"
          title="Profile"
          subtitle={
            isEditing ? 'Update your account details.' : 'Your account information and credentials.'
          }
          actions={
            <Button
              variant={isEditing ? 'outline' : 'default'}
              className="w-full gap-2 md:w-auto"
              data-test={isEditing ? 'profile-cancel-edit-button' : 'profile-edit-button'}
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false);
                  setDraftProfile({ fullName: '' });
                  return;
                }

                setIsEditing(true);
                setDraftProfile({ fullName: user.fullname || '' });
              }}
            >
              <Pencil className="h-4 w-4" />
              {isEditing ? 'Cancel editing' : 'Edit profile'}
            </Button>
          }
        />

        {/* The mockup's two-column profile: the things you act on down the wide
            side, the things you can only read down the narrow one. `items-start`
            keeps the right column from stretching its last card to match the
            left, which is much taller. */}
        <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3.5">
            <ProfileIdentityCard user={user} isEditing={isEditing} />

            <ProfileStatRow
              analytics={analytics}
              attendance={attendance}
              isIntern={isIntern}
              isLoading={(!!workspaceId && isAnalyticsLoading) || (isIntern && isAttendanceLoading)}
            />

            <section className="app-card px-[18px] py-[15px] pb-[18px]">
              <h2 className="app-card-title">Account details</h2>

              <form className="mt-3.5 space-y-5" onSubmit={handleSave}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-fullname">Full name</Label>
                    {isEditing ? (
                      <Input
                        id="profile-fullname"
                        value={profile.fullName}
                        onChange={(e) =>
                          setDraftProfile((current) => ({ ...current, fullName: e.target.value }))
                        }
                        data-test="profile-fullname-input"
                      />
                    ) : (
                      <div className="rounded-[var(--r-card)] border border-border bg-muted/30 px-3.5 py-2.5 text-sm">
                        {profile.fullName || '—'}
                      </div>
                    )}
                    {isEditing && !isFullNameValid && (
                      <p className="text-xs text-[hsl(var(--tone-danger-fg))]">
                        Full name is required.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="rounded-[var(--r-card)] border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
                      {profile.email}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Your email can’t be changed here.
                    </p>
                  </div>

                  {isEditing && updateUserMutation.isError && (
                    <div className="md:col-span-2 rounded-[var(--r-control)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[hsl(var(--tone-danger-fg))]">
                      {updateUserMutation.error?.response?.data?.message ||
                        'Something went wrong. Please try again.'}
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:order-1"
                      onClick={() => {
                        setIsEditing(false);
                        setDraftProfile({ fullName: '' });
                      }}
                      data-test="profile-form-cancel-button"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateUserMutation.isPending || !isFullNameValid}
                      data-test="profile-save-button"
                    >
                      {updateUserMutation.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                )}
              </form>
            </section>

            <ChangePasswordPanel />

            <ProfileActivityPanel items={activity} isLoading={!!workspaceId && isTicketsLoading} />
          </div>

          <div className="flex min-w-0 flex-col gap-3.5">
            {isIntern && <InternSelfServicePanel />}
            <ProfileMetaCard title="Account" rows={accountRows} dataTest="profile-account-panel" />
          </div>
        </div>
      </PageSection>
    </PageShell>
  );
};

export default ProfilePage;
