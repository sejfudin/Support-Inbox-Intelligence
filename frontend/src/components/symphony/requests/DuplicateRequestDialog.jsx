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

/**
 * Shown BEFORE the request is filed, while the form still holds an unsent
 * draft — a warning, not a notification. Nothing about this blocks: filing a
 * second request against the same project is legitimate (a second wave of
 * demand months later is its own ask), so the point is only that the author
 * finds out while the choice is still theirs.
 *
 * Three ways out, all real: file anyway, go look at the existing request, or
 * back to the form.
 */
export function DuplicateRequestDialog({
  open,
  duplicateOf,
  isSaving,
  onCancel,
  onFileAnyway,
  onViewExisting,
}) {
  if (!duplicateOf) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md" data-test="duplicate-request-dialog">
        <DialogHeader>
          <DialogTitle>Already an open request for this project</DialogTitle>
          <DialogDescription>
            {duplicateOf.author?.fullname ?? 'Someone'} filed a request for this project on{' '}
            {format(new Date(duplicateOf.createdAt), 'MMM d, yyyy')}. You can still file yours
            separately — nothing about the existing one changes either way.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onViewExisting}
            data-test="duplicate-request-view-existing"
          >
            View existing request
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Back to form
            </Button>
            <Button
              type="button"
              onClick={onFileAnyway}
              disabled={isSaving}
              data-test="duplicate-request-file-anyway"
            >
              {isSaving ? 'Filing…' : 'File anyway'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
