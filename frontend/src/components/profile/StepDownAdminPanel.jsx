import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminCandidates } from '@/queries/users';
import { useStepDownAsAdmin } from '@/queries/auth';
import { resolveUserId } from '@/helpers/userIdentity';

/**
 * Admin-only "danger zone" panel: step down and hand the role to another
 * admin, who becomes your mentor. Mirrors `ChangePasswordPanel`'s expand/
 * collapse shape, but the warning is part of the collapsed-to-expanded form
 * itself rather than a separate `ConfirmModal` — there is a choice to make
 * (which admin takes over) before there is anything to confirm.
 */
export function StepDownAdminPanel({ user }) {
  const [isEditing, setIsEditing] = useState(false);
  const [targetAdminId, setTargetAdminId] = useState('');

  const { data: adminCandidates } = useAdminCandidates();
  const stepDown = useStepDownAsAdmin();

  const selfId = resolveUserId(user);
  const otherAdmins = (adminCandidates?.users || []).filter(
    (candidate) => resolveUserId(candidate) !== selfId
  );
  const targetAdmin = otherAdmins.find((candidate) => resolveUserId(candidate) === targetAdminId);

  const close = () => {
    setIsEditing(false);
    setTargetAdminId('');
    stepDown.reset();
  };

  const handleConfirm = () => {
    if (!targetAdminId) return;

    stepDown.mutate(
      { newAdminMentorId: targetAdminId },
      {
        onSuccess: () => {
          toast.success('You stepped down as admin', {
            description: `${targetAdmin?.fullname || 'The admin you chose'} now has your admin permissions. Log back in to continue as an intern.`,
          });
        },
      }
    );
  };

  return (
    <section
      className="app-card border-[hsl(var(--tone-danger)/0.3)] px-[18px] py-[15px]"
      data-test="profile-step-down-panel"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0 space-y-0.5">
          <h2 className="app-card-title">Step down as admin</h2>
          <p className="text-[12.5px] leading-[1.45] text-muted-foreground">
            {isEditing
              ? 'Choose the admin who takes over.'
              : 'Hand your admin role to someone else and become an intern.'}
          </p>
        </div>

        {!isEditing && (
          <Button
            variant="outline"
            className="w-full shrink-0 gap-2 border-[hsl(var(--tone-danger)/0.4)] text-[hsl(var(--tone-danger-fg))] hover:bg-[hsl(var(--tone-danger)/0.1)] sm:w-auto"
            onClick={() => setIsEditing(true)}
            data-test="profile-step-down-button"
          >
            Step down…
          </Button>
        )}
      </div>

      {isEditing && (
        <div className="mt-[15px] space-y-5 border-t border-separator pt-[15px]">
          <div className="space-y-2">
            <Label htmlFor="step-down-admin-select">New admin</Label>
            {otherAdmins.length > 0 ? (
              <Select value={targetAdminId} onValueChange={setTargetAdminId}>
                <SelectTrigger id="step-down-admin-select" data-test="step-down-admin-select">
                  <SelectValue placeholder="Select an admin" />
                </SelectTrigger>
                <SelectContent>
                  {otherAdmins.map((admin) => (
                    <SelectItem
                      key={resolveUserId(admin)}
                      value={resolveUserId(admin)}
                      data-test={`step-down-admin-option-${resolveUserId(admin)}`}
                    >
                      {admin.fullname} ({admin.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                There's no other active admin to hand this over to yet.
              </p>
            )}
          </div>

          <div className="flex gap-3 rounded-[var(--r-control)] border border-[hsl(var(--tone-danger)/0.3)] bg-[hsl(var(--tone-danger)/0.08)] p-3.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(var(--tone-danger-fg))]" />
            <p className="text-[12.5px] leading-[1.5] text-[hsl(var(--tone-danger-fg))]">
              All of your admin permissions move to{' '}
              <strong>{targetAdmin?.fullname || 'the admin you choose'}</strong>, and you become an
              intern mentored by them. This can't be undone automatically — the only way back is for
              them to hand the admin role back to you through this same process.
            </p>
          </div>

          {stepDown.isError && (
            <div
              className="rounded-[var(--r-control)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[hsl(var(--tone-danger-fg))]"
              data-test="profile-step-down-error"
            >
              {stepDown.error?.response?.data?.message || 'Something went wrong. Please try again.'}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="sm:order-1"
              onClick={close}
              data-test="profile-step-down-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive-solid"
              disabled={stepDown.isPending || !targetAdminId}
              onClick={handleConfirm}
              data-test="profile-step-down-confirm-button"
            >
              {stepDown.isPending ? 'Stepping down…' : 'Step down and hand over admin'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
