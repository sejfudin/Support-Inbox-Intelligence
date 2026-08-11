import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// Informational, not a blocker — the request this warns about was already
// created by the time this shows. "File anyway" is just dismissing it; the
// only real choice here is whether to also go look at the existing one.
export function DuplicateRequestDialog({ open, onOpenChange, duplicateOf, onViewExisting }) {
  if (!duplicateOf) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-test="duplicate-request-dialog">
        <DialogHeader>
          <DialogTitle>Already an open request for this project</DialogTitle>
          <DialogDescription>
            {duplicateOf.author?.fullname ?? 'Someone'} filed a request for this project on{' '}
            {format(new Date(duplicateOf.filedAt), 'MMM d, yyyy')}. Your request has been filed
            separately — nothing about the existing one changed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            File anyway
          </Button>
          <Button
            type="button"
            onClick={() => {
              onViewExisting?.();
              onOpenChange(false);
            }}
            data-test="duplicate-request-view-existing"
          >
            View existing request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
