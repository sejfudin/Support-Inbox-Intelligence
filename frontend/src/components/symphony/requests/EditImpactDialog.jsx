import { useEffect, useState } from 'react';
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

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/**
 * The confirmation an edit needs when it costs something: candidates closed out
 * because a position stopped being asked for, recommendations moved because the
 * project did. Neither is a refusal — the edit is legal, it just has a
 * consequence someone should read before it happens.
 *
 * The not-placed reason is mandatory exactly when the edit closes anyone out,
 * matching the server (planStaffingRequestEdit + the ticket-09 cascade): the
 * cascade writes that one line onto every closed-out record, and a blank one
 * leaves an intern with no stated reason at all.
 */
export function EditImpactDialog({ open, impact, projectName, isSaving, onCancel, onConfirm }) {
  const [notPlacedReason, setNotPlacedReason] = useState('');

  useEffect(() => {
    if (open) setNotPlacedReason('');
  }, [open]);

  if (!impact) return null;

  const { closeOutCount, endingPositions, projectChanged, movingCount } = impact;
  const closingPositions = endingPositions.filter((position) => position.inSelection > 0);
  const trimmedReason = notPlacedReason.trim();
  const reasonMissing = closeOutCount > 0 && !trimmedReason;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md" data-test="edit-impact-dialog">
        <DialogHeader>
          <DialogTitle>Save these changes?</DialogTitle>
          <DialogDescription>
            The ask has moved, and that reaches the candidates already on it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {closeOutCount > 0 && (
            <p
              className="symphony-notice symphony-notice-warning"
              data-test="edit-impact-close-out"
            >
              <span>
                {closingPositions
                  .map(
                    (position) =>
                      `${plural(position.inSelection, 'candidate')} put forward for ${position.name}`
                  )
                  .join(', ')}{' '}
                will be closed out as not placed. This can’t be undone.
              </span>
            </p>
          )}

          {projectChanged && (
            <p className="symphony-notice symphony-notice-info" data-test="edit-impact-move">
              <span>
                {movingCount > 0
                  ? `${plural(movingCount, 'candidate')} put forward will move to ${projectName} with this request. Anyone already placed moves too.`
                  : `This request will point at ${projectName} instead.`}
              </span>
            </p>
          )}

          {closeOutCount > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-impact-not-placed">
                Why they weren’t placed ({plural(closeOutCount, 'intern')})
              </Label>
              <Textarea
                id="edit-impact-not-placed"
                placeholder="The client changed what they were asking for…"
                value={notPlacedReason}
                maxLength={5000}
                onChange={(event) => setNotPlacedReason(event.target.value)}
                data-test="edit-impact-not-placed"
              />
              <p className="text-xs text-muted-foreground">
                One reason, recorded on every one of them, and read by admins, leadership and
                mentors — never by the intern.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Back to form
          </Button>
          <Button
            type="button"
            disabled={isSaving || reasonMissing}
            onClick={() => onConfirm({ notPlacedReason: trimmedReason })}
            data-test="edit-impact-confirm"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
