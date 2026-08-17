import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';
import { UserStatusBadge } from '@/components/UserStatusBadge';
import { RoleBadge } from '@/components/RoleBadge';
import { useUpdateUser } from '@/queries/auth';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { InternSelfServicePanel } from '@/components/interns/InternSelfServicePanel';
import { ChangePasswordPanel } from '@/components/profile/ChangePasswordPanel';
import { AttendanceLimitsPanel } from '@/components/profile/AttendanceLimitsPanel';
import { isAdmin, isIntern } from '@/helpers/roles';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);

  const { user, loading, refetchUser } = useAuth();
  const updateUserMutation = useUpdateUser();

  const [draftProfile, setDraftProfile] = useState({ fullName: '' });

  const handleSave = (e) => {
    e.preventDefault();
    const id = user?.id || user?._id;

    updateUserMutation.mutate(
      { id, data: { fullname: draftProfile.fullName } },
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

  if (loading) return <TableSkeleton />;
  if (!user)
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        Error Loading User Profile.
      </div>
    );

  const profile = {
    fullName: isEditing ? draftProfile.fullName : user.fullname || '',
    email: user.email || '',
    role: user.role || 'User',
    status: user.status || 'Active',
  };

  const isFullNameValid = profile.fullName.trim().length > 0;

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <PageHeading
            crumb="Account"
            title="Profile"
            subtitle={
              isEditing
                ? 'Update your account details.'
                : 'Your account information and credentials.'
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

          <PagePanel className="px-5 py-6 md:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="shrink-0">
                  <Avatar users={[user]} size="lg" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold leading-tight truncate">
                    {user.fullname || '—'}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{user.email || '—'}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={profile.role} />
                <UserStatusBadge status={profile.status} />
              </div>
            </div>
          </PagePanel>

          <PagePanel className="px-5 py-6 md:px-6">
            <form className="space-y-6" onSubmit={handleSave}>
              <div className="grid gap-6 md:grid-cols-2">
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
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      {profile.fullName || '—'}
                    </div>
                  )}
                  {isEditing && !isFullNameValid && (
                    <p className="text-xs text-destructive">Full name is required.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    {profile.email}
                  </div>
                  <p className="text-xs text-muted-foreground">Your email can’t be changed here.</p>
                </div>

                {isEditing && updateUserMutation.isError && (
                  <div className="md:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
          </PagePanel>

          <ChangePasswordPanel />

          {isIntern(user?.role) && <InternSelfServicePanel />}

          {isAdmin(user?.role) && <AttendanceLimitsPanel />}
        </div>
      </PageSection>
    </PageShell>
  );
};

export default ProfilePage;
