import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCloseStaffingRequest } from '@/queries/staffingRequests';

// One dialog, three reasons. They differ in who may use them, whether the note
// is required, and — importantly — where that note is stored: a cancellation
// reason goes to `closeNote`, a decline's reason becomes the admin's `note`.
// The copy has to say which, or an admin writes a decline reason expecting
// leadership to read it somewhere else.
const REASON_COPY = {
  fulfilled: {
    title: 'Close this request as fulfilled?',
    description:
      'The seats are filled and the request is done. It stays on record with everyone who was put forward.',
    noteLabel: 'Note for leadership (optional)',
    notePlaceholder: 'Anything they should know about the placements…',
    confirm: 'Close as fulfilled',
    variant: 'default',
    noteRequired: false,
  },
  declined: {
    title: 'Decline this request?',
    description:
      'The ask is being refused rather than filled. Your reason becomes the note leadership reads on the request, so it needs to explain the decision.',
    noteLabel: 'Reason',
    notePlaceholder: 'No capacity this quarter…',
    confirm: 'Decline request',
    variant: 'destructive',
    noteRequired: true,
  },
  cancelled: {
    title: 'Cancel this request?',
    description:
      'The request stays on record, closed, so what was asked for and when is never lost. Any interns already put forward keep their status — cancelling changes nothing about them.',
    noteLabel: 'Reason (optional)',
    notePlaceholder: 'Why the opportunity evaporated…',
    confirm: 'Cancel request',
    variant: 'destructive',
    noteRequired: false,
  },
};

export function CloseRequestDialog({ open, onOpenChange, request, reason }) {
  const [note, setNote] = useState('');
  const closeMutation = useCloseStaffingRequest();
  const copy = REASON_COPY[reason];

  useEffect(() => {
    if (open) setNote('');
  }, [open, reason]);

  if (!request || !copy) return null;

  const trimmed = note.trim();
  const blocked = copy.noteRequired && !trimmed;

  const handleConfirm = () => {
    closeMutation.mutate(
      { id: request.id, data: { reason, note: trimmed || undefined } },
      {
        onSuccess: () => {
          toast.success(copy.confirm.replace(/^Close as /, 'Closed as '));
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error('Could not close the request', {
            description: error?.response?.data?.message,
          }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-test={`close-request-dialog-${reason}`}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="close-request-note">{copy.noteLabel}</Label>
          <Textarea
            id="close-request-note"
            placeholder={copy.notePlaceholder}
            value={note}
            maxLength={5000}
            onChange={(event) => setNote(event.target.value)}
            data-test="close-request-note"
          />
          {copy.noteRequired && !trimmed && (
            <p className="text-xs text-muted-foreground">
              A reason is required to decline — the server rejects a blank one.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Keep request open
          </Button>
          <Button
            type="button"
            variant={copy.variant}
            disabled={closeMutation.isPending || blocked}
            onClick={handleConfirm}
            data-test="close-request-confirm"
          >
            {closeMutation.isPending ? 'Saving…' : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
