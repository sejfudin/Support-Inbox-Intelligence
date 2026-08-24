import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAdminCandidates } from '@/queries/users';
import { useTransferInternPrimaryMentor } from '@/queries/interns';
import { resolveUserId } from '@/helpers/userIdentity';

/**
 * Self-scoped hand-off: the admin who is this intern's current primary mentor
 * gives that relationship to a different admin. Restricted to the `admin`
 * role on purpose — see `server/services/internService.js#transferPrimaryMentor`
 * — unlike the general primary-mentor rule, a mentor-role candidate can't be
 * picked here, because the point is platform responsibility for the intern
 * moving between admins, not a mentor-pairing change.
 */
export function TransferPrimaryMentorModal({ intern, open, onClose }) {
  const [newAdminId, setNewAdminId] = useState('');
  const [error, setError] = useState('');

  const { data: adminsData } = useAdminCandidates();
  const admins = adminsData?.users ?? [];
  const currentMentorId = resolveUserId(intern?.primaryMentor);
  // The secondary mentor is excluded too: the server refuses a primary mentor
  // that matches the specialization mentor already on the profile (mirrors
  // the "must differ from primary mentor" rule specialization enforces from
  // the other direction).
  const secondaryMentorId = resolveUserId(intern?.secondaryMentor);
  const eligibleAdmins = admins.filter(
    (admin) =>
      resolveUserId(admin) !== currentMentorId && resolveUserId(admin) !== secondaryMentorId
  );
  const newAdmin = eligibleAdmins.find((admin) => resolveUserId(admin) === newAdminId);

  const transferMutation = useTransferInternPrimaryMentor();

  const resetAndClose = () => {
    setNewAdminId('');
    setError('');
    transferMutation.reset();
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!newAdminId) return;
    setError('');
    try {
      await transferMutation.mutateAsync({
        userId: intern?.user?._id,
        newAdminId,
      });
      resetAndClose();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Failed to transfer this intern.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resetAndClose()}>
      <DialogContent data-test="transfer-primary-mentor-dialog">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Transfer {intern?.user?.fullname || 'this intern'}</DialogTitle>
            <DialogDescription>
              Hand your primary mentor role for this intern to another admin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="transfer-primary-mentor-select">New admin</Label>
            {eligibleAdmins.length > 0 ? (
              <Select value={newAdminId} onValueChange={setNewAdminId}>
                <SelectTrigger
                  id="transfer-primary-mentor-select"
                  data-test="transfer-primary-mentor-select"
                >
                  <SelectValue placeholder="Select an admin" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleAdmins.map((admin) => (
                    <SelectItem
                      key={resolveUserId(admin)}
                      value={resolveUserId(admin)}
                      data-test={`transfer-primary-mentor-option-${resolveUserId(admin)}`}
                    >
                      {admin.fullname} ({admin.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                There's no other active admin to transfer this intern to yet.
              </p>
            )}
          </div>

          <div className="flex gap-3 rounded-[var(--r-control)] border border-[hsl(var(--tone-danger)/0.3)] bg-[hsl(var(--tone-danger)/0.08)] p-3.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(var(--tone-danger-fg))]" />
            <p className="text-[12.5px] leading-[1.5] text-[hsl(var(--tone-danger-fg))]">
              All of your admin responsibility for {intern?.user?.fullname || 'this intern'} moves
              to <strong>{newAdmin?.fullname || 'the admin you choose'}</strong>. This can't be
              undone automatically — the only way back is for them to transfer this intern to you
              again the same way.
            </p>
          </div>

          {error && (
            <p
              className="text-sm text-[hsl(var(--tone-danger-fg))]"
              data-test="transfer-primary-mentor-error"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive-solid"
              disabled={!newAdminId || transferMutation.isPending}
              data-test="transfer-primary-mentor-submit-button"
            >
              {transferMutation.isPending ? 'Transferring…' : 'Transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
