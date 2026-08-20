import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useReassignSpecialization } from '@/queries/specializations';

export function ReassignSpecializationDialog({ specialization, onClose }) {
  const reassignMutation = useReassignSpecialization();

  const open = Boolean(specialization);
  const fromLabel = specialization?.declaredPosition?.name || 'their current position';
  const toLabel = specialization?.secondaryPosition?.name || 'their other position';

  const handleConfirm = async () => {
    await reassignMutation.mutateAsync(specialization.user?._id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-test="reassign-specialization-dialog">
        <DialogHeader>
          <DialogTitle>Reassign specialization</DialogTitle>
          <DialogDescription>
            Move {specialization?.user?.fullname || 'this intern'}&apos;s specialization from{' '}
            {fromLabel} to {toLabel}. Their mentor stays the same.
          </DialogDescription>
        </DialogHeader>
        {reassignMutation.isError && (
          <p
            className="text-sm text-[hsl(var(--tone-danger-fg))]"
            data-test="reassign-specialization-error"
          >
            {reassignMutation.error?.response?.data?.message || 'Failed to reassign.'}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={reassignMutation.isPending}
            data-test="reassign-specialization-confirm-button"
          >
            {reassignMutation.isPending ? 'Reassigning...' : 'Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
