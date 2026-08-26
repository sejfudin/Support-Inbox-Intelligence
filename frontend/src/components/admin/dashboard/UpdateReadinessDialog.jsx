import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InternReadinessPanel } from '@/components/interns/InternReadinessPanel';
import { useIntern } from '@/queries/interns';

/**
 * "Update readiness" from the dashboard.
 *
 * The profile's own readiness panel, unchanged, in a dialog — it already owns the
 * per-technology levels, the mutation and its toasts, and every level it writes
 * lands the moment it is picked, so there is nothing here to save. Flattened
 * (`p-0`, no border, no card background) because a card inside a dialog reads as
 * a panel that lost its page.
 *
 * Readiness is admin-only in `readinessFlagService.upsertReadinessFlag`, and the
 * panel gates its own writes on the same rule — so this dialog is admin-only by
 * inheritance rather than by a check of its own.
 */
export function UpdateReadinessDialog({ internUserId, open, onClose }) {
  const { data: intern } = useIntern(internUserId, { enabled: Boolean(internUserId) });
  const internName = intern?.user?.fullname || 'this intern';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Readiness — {internName}</DialogTitle>
        </DialogHeader>

        {internUserId && (
          <InternReadinessPanel
            userId={internUserId}
            declaredTechnologies={intern?.selfTechnologies || []}
            className="border-0 bg-transparent p-0 shadow-none"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
