import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangePassword } from '@/queries/auth';

const MIN_LENGTH = 6;
const EMPTY = { currentPassword: '', newPassword: '' };

/**
 * Changing your own password, on its own, for every role that has a profile.
 *
 * Split out of the profile form because it stopped being a field on it: proving
 * you know the current password needs a second input, and folding that into
 * "Save changes" would demand it from someone who only came to fix a typo in
 * their name.
 */
export function ChangePasswordPanel() {
  const [isEditing, setIsEditing] = useState(false);
  const [shown, setShown] = useState({ currentPassword: false, newPassword: false });
  const [draft, setDraft] = useState(EMPTY);

  const changePassword = useChangePassword();

  const close = () => {
    setIsEditing(false);
    setShown({ currentPassword: false, newPassword: false });
    setDraft(EMPTY);
    changePassword.reset();
  };

  const isLongEnough = draft.newPassword.length >= MIN_LENGTH;
  const isDifferent = draft.newPassword !== draft.currentPassword;
  const canSubmit = draft.currentPassword.length > 0 && isLongEnough && isDifferent;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    changePassword.mutate(draft, {
      onSuccess: (data) => {
        close();
        toast.success('Password changed', {
          description: data?.message || 'Any other sessions have been signed out.',
        });
      },
    });
  };

  const field = (name, label, autoComplete) => (
    <div className="space-y-2">
      <Label htmlFor={`profile-${name}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`profile-${name}`}
          type={shown[name] ? 'text' : 'password'}
          value={draft[name]}
          autoComplete={autoComplete}
          onChange={(e) => setDraft((current) => ({ ...current, [name]: e.target.value }))}
          className="pr-12"
          data-test={`profile-${name}-input`}
        />
        <button
          type="button"
          onClick={() => setShown((current) => ({ ...current, [name]: !current[name] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={shown[name] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          data-test={`profile-${name}-toggle-button`}
        >
          {shown[name] ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <section className="app-card px-[18px] py-[15px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0 space-y-0.5">
          <h2 className="app-card-title">Password</h2>
          <p className="text-[12.5px] leading-[1.45] text-muted-foreground">
            {isEditing
              ? 'Enter your current password, then the one you want to use.'
              : 'Changing it signs out every other device you are signed in on.'}
          </p>
        </div>

        {!isEditing && (
          <Button
            variant="outline"
            className="w-full shrink-0 gap-2 sm:w-auto"
            onClick={() => setIsEditing(true)}
            data-test="profile-change-password-button"
          >
            Change password
          </Button>
        )}
      </div>

      {isEditing && (
        <form
          className="mt-[15px] space-y-5 border-t border-separator pt-[15px]"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {field('currentPassword', 'Current password', 'current-password')}
            {field('newPassword', 'New password', 'new-password')}

            <div className="space-y-1 md:col-span-2">
              {draft.newPassword.length > 0 && !isLongEnough && (
                <p className="text-xs text-[hsl(var(--tone-danger-fg))]">
                  Password must be at least {MIN_LENGTH} characters long.
                </p>
              )}
              {isLongEnough && !isDifferent && (
                <p className="text-xs text-[hsl(var(--tone-danger-fg))]">
                  Your new password must be different from your current one.
                </p>
              )}
            </div>

            {changePassword.isError && (
              <div
                className="md:col-span-2 rounded-[var(--r-control)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[hsl(var(--tone-danger-fg))]"
                data-test="profile-password-error"
              >
                {changePassword.error?.response?.data?.message ||
                  'Something went wrong. Please try again.'}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="sm:order-1"
              onClick={close}
              data-test="profile-password-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={changePassword.isPending || !canSubmit}
              data-test="profile-password-save-button"
            >
              {changePassword.isPending ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
