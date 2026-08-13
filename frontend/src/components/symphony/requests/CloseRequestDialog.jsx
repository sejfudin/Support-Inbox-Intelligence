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
import { getCloseOutSuggestions } from './requestPresentation';
import { useCloseStaffingRequest } from '@/queries/staffingRequests';

// One dialog, three reasons. They differ in who may use them, whether the close
// reason is required, and — importantly — where that text is stored: a
// cancellation reason goes to `closeNote`, a decline's reason becomes the
// admin's `note`. The copy has to say which, or an admin writes a decline reason
// expecting leadership to read it somewhere else.
//
// Both closes that leave the ask unmet — cancel and decline — require the
// reason; only a fulfil may skip it. Nothing on a closed request can be edited
// afterwards (ADR 0005), so this dialog is the only chance anyone gets to say
// why, and the copy says so.
//
// Every reason closes out whoever is still in selection, so the second field
// below is shared by all three rather than being a cancellation special case.
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
    notPlacedPlaceholder: 'The seats went to other candidates…',
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
    notPlacedPlaceholder: 'We could not staff this request…',
  },
  cancelled: {
    title: 'Cancel this request?',
    description:
      'The request stays on record, closed, so what was asked for and when is never lost. Your reason is stored with it and cannot be changed afterwards. Cancelling is all-or-nothing — if the ask has only shrunk, lower the count instead and nobody is closed out.',
    noteLabel: 'Reason',
    notePlaceholder: 'Why the opportunity evaporated…',
    confirm: 'Cancel request',
    variant: 'destructive',
    noteRequired: true,
    notPlacedPlaceholder: 'The client withdrew the ask…',
  },
};

/**
 * Closing a request, and closing out its candidates.
 *
 * Two fields, close reason first. The second is the one shared reason written
 * onto every candidate still in selection — mandatory when there is at least
 * one, absent when there is none, and never a per-intern text box: a bulk field
 * per person invites a bulk judgement about each of them. An admin with
 * something to say to one intern says it on that intern's recommendation, which
 * is what the hint under the field points at.
 *
 * Placeholders, never prefilled values, in either field. A default gets
 * submitted unread, and then it isn't a reason.
 *
 * The dialog also has to state that this is permanent: there is no reopen
 * (ADR 0005), and this is the only warning anyone gets.
 */
export function CloseRequestDialog({ open, onOpenChange, request, reason }) {
  const [note, setNote] = useState('');
  const [notPlacedReason, setNotPlacedReason] = useState('');
  const closeMutation = useCloseStaffingRequest();
  const copy = REASON_COPY[reason];

  useEffect(() => {
    if (open) {
      setNote('');
      setNotPlacedReason('');
    }
  }, [open, reason]);

  if (!request || !copy) return null;

  // Counted the way the server counts (`selectCloseOutRecommendations`): tagged,
  // still in selection, and for a position the request still asks for. The
  // second field below is required off this number, so a count that disagreed
  // with the server's would block a close the server would have allowed.
  const closingOut = getCloseOutSuggestions(request).length;
  const trimmedNote = note.trim();
  const trimmedNotPlaced = notPlacedReason.trim();
  const blocked = (copy.noteRequired && !trimmedNote) || (closingOut > 0 && !trimmedNotPlaced);

  const handleConfirm = () => {
    closeMutation.mutate(
      {
        id: request.id,
        data: {
          reason,
          note: trimmedNote || undefined,
          notPlacedReason: trimmedNotPlaced || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(copy.confirm.replace(/^Close as /, 'Closed as '), {
            description:
              closingOut > 0
                ? `${closingOut} ${closingOut === 1 ? 'intern was' : 'interns were'} closed out.`
                : undefined,
          });
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

        {/* The consequence, in the one place it cannot be missed. Both halves
            are permanent, and the second is about other people. */}
        <p className="symphony-notice symphony-notice-warning" data-test="close-request-warning">
          <span>
            This can’t be undone.{' '}
            {closingOut > 0
              ? `${closingOut} ${closingOut === 1 ? 'intern still in selection' : 'interns still in selection'} will be closed out as not placed. Anyone already placed keeps their placement.`
              : 'Nobody is still in selection, so no candidate records change.'}
          </span>
        </p>

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
          {copy.noteRequired && !trimmedNote && (
            <p className="text-xs text-muted-foreground">
              A reason is required — the server rejects a blank one, and it can’t be added later.
            </p>
          )}
        </div>

        {closingOut > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="close-request-not-placed">
              Why they weren’t placed ({closingOut} {closingOut === 1 ? 'intern' : 'interns'})
            </Label>
            <Textarea
              id="close-request-not-placed"
              placeholder={copy.notPlacedPlaceholder}
              value={notPlacedReason}
              maxLength={5000}
              onChange={(event) => setNotPlacedReason(event.target.value)}
              data-test="close-request-not-placed"
            />
            <p className="text-xs text-muted-foreground">
              One reason, recorded on every one of them, and read by admins, leadership and mentors
              — never by the intern. For something specific to one person, open their recommendation
              instead.
            </p>
          </div>
        )}

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
