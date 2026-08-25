import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { useMentorNoteCandidates, useSendMentorNote } from '@/queries/users';
import { resolveUserId } from '@/helpers/userIdentity';

const MAX_LENGTH = 500;

/**
 * Admin/leadership sending a note directly to a mentor — the mentor sees it
 * on their dashboard's "Notes for me" card.
 *
 * Two modes, one component: pass `targetUserId` (and optionally `targetName`)
 * when the caller already knows who — the admin's per-mentor `/user/:userId`
 * page does this, no picker needed. Leave both out and it renders a mentor
 * picker first — leadership's entry point, which has no per-mentor page of
 * its own to launch from.
 */
export function SendMentorNoteModal({ open, onClose, targetUserId, targetName }) {
  const [pickedMentorId, setPickedMentorId] = useState('');
  const [body, setBody] = useState('');

  const needsPicker = !targetUserId;
  const { data: mentorsData, isPending: isMentorsPending } = useMentorNoteCandidates({
    enabled: open && needsPicker,
  });
  const mentors = mentorsData?.users ?? [];

  const { mutate, isPending: isSaving } = useSendMentorNote();

  useEffect(() => {
    if (open) {
      setPickedMentorId('');
      setBody('');
    }
  }, [open]);

  const recipientId = targetUserId || pickedMentorId;
  const recipientName =
    targetName || mentors.find((mentor) => resolveUserId(mentor) === pickedMentorId)?.fullname;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!recipientId || !body.trim()) return;

    mutate(
      { userId: recipientId, body: body.trim() },
      {
        onSuccess: () => {
          toast.success(`Note sent to ${recipientName || 'the mentor'}`);
          onClose();
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to send note'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSaving && onClose()}>
      <DialogContent data-test="send-mentor-note-dialog">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {targetName ? `Note ${targetName}` : 'Send a note to a mentor'}
            </DialogTitle>
            <DialogDescription>
              They'll see this on their dashboard — it isn't about any intern, just a note to them.
            </DialogDescription>
          </DialogHeader>

          {needsPicker && (
            <div className="space-y-2">
              <Label htmlFor="send-mentor-note-select">Mentor</Label>
              {isMentorsPending ? (
                <p className="text-sm text-muted-foreground">Loading mentors…</p>
              ) : mentors.length > 0 ? (
                <Select value={pickedMentorId} onValueChange={setPickedMentorId}>
                  <SelectTrigger id="send-mentor-note-select" data-test="send-mentor-note-select">
                    <SelectValue placeholder="Select a mentor" />
                  </SelectTrigger>
                  <SelectContent>
                    {mentors.map((mentor) => (
                      <SelectItem
                        key={resolveUserId(mentor)}
                        value={resolveUserId(mentor)}
                        data-test={`send-mentor-note-option-${resolveUserId(mentor)}`}
                      >
                        {mentor.fullname} ({mentor.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">There are no active mentors yet.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="send-mentor-note-body">Note</Label>
            <AutoTextarea
              id="send-mentor-note-body"
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, MAX_LENGTH))}
              rows={4}
              placeholder="What do they need to know?"
              data-test="send-mentor-note-body"
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {body.length}/{MAX_LENGTH}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !recipientId || !body.trim()}
              data-test="send-mentor-note-submit"
            >
              {isSaving ? 'Sending…' : 'Send note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
