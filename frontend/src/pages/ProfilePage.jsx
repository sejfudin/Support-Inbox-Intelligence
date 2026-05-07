import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import { UserStatusBadge } from '@/components/UserStatusBadge';
import { RoleBadge } from '@/components/RoleBadge';
import { useUpdateUser } from '@/queries/auth';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { user, loading, refetchUser } = useAuth();
  const updateUserMutation = useUpdateUser();

  const [draftProfile, setDraftProfile] = useState({
    fullName: '',
    password: '',
  });

  const handleSave = (e) => {
    e.preventDefault();
    const id = user?.id || user?._id;
    const payload = {
      fullname: draftProfile.fullName,
    };

    if (draftProfile.password) {
      payload.password = draftProfile.password;
    }

    updateUserMutation.mutate(
      { id, data: payload },
      {
        onSuccess: () => {
          setIsEditing(false);
          setShowPassword(false);
          setDraftProfile({ fullName: '', password: '' });
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
    password: isEditing ? draftProfile.password : '',
  };

  const isFullNameValid = profile.fullName.trim().length > 0;
  const isPasswordValid = profile.password.length === 0 || profile.password.length >= 6;
  const isFormValid = isFullNameValid && isPasswordValid;

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <PagePanel className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="min-w-0">
              <div className="app-kicker mb-3">Account</div>
              <h1 className="app-title">Profile</h1>
              <p className="app-subtitle">
                {isEditing ? 'Update your details.' : 'Your account information.'}
              </p>
            </div>

            <div className="flex w-full items-center gap-2 md:w-auto">
              <Button
                variant={isEditing ? 'outline' : 'default'}
                className="w-full gap-2 md:w-auto"
                onClick={() => {
                  if (isEditing) {
                    setIsEditing(false);
                    setShowPassword(false);
                    setDraftProfile({ fullName: '', password: '' });
                    return;
                  }

                  setIsEditing(true);
                  setDraftProfile({
                    fullName: user.fullname || '',
                    password: '',
                  });
                }}
              >
                <Pencil className="h-4 w-4" />
                {isEditing ? 'Cancel editing' : 'Edit profile'}
              </Button>
            </div>
          </PagePanel>

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
                  <Label>Full name</Label>
                  {isEditing ? (
                    <Input
                      value={profile.fullName}
                      onChange={(e) =>
                        setDraftProfile((current) => ({ ...current, fullName: e.target.value }))
                      }
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

                <div className="space-y-2 md:col-span-2">
                  <Label>{isEditing ? 'New password (optional)' : 'Password'}</Label>
                  {isEditing ? (
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Leave blank to keep current password"
                        value={profile.password}
                        onChange={(e) =>
                          setDraftProfile((current) => ({ ...current, password: e.target.value }))
                        }
                        className="pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">********</div>
                  )}

                  {isEditing && !isPasswordValid && (
                    <p className="text-xs text-destructive">
                      Password must be at least 6 characters long.
                    </p>
                  )}
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
                      setShowPassword(false);
                      setDraftProfile({ fullName: '', password: '' });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateUserMutation.isPending || !isFormValid}>
                    {updateUserMutation.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              )}
            </form>
          </PagePanel>
        </div>
      </PageSection>
    </PageShell>
  );
};

export default ProfilePage;
