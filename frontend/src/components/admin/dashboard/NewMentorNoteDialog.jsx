import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { SharedWithMenu } from '@/components/interns/InternCommentsPanel';
import { useAuth } from '@/context/AuthContext';
import { resolveUserId } from '@/helpers/userIdentity';
import { useCommentViewers, useCreateInternComment, useIntern } from '@/queries/interns';

/**
 * "Write a note" from the dashboard, without leaving the dashboard.
 *
 * The same mutation and the same two audience fields as the mentor-notes panel on
 * the intern's profile — `visibleTo` (named people) and `visibleToIntern` (the
 * note's subject) — through the very control that panel uses, so the rules about
 * who a note can reach are stated once. A note written here is the same note.
 */
export function NewMentorNoteDialog({ internUserId, open, onClose }) {
  const { user } = useAuth();
  const { data: intern } = useIntern(internUserId, { enabled: Boolean(internUserId) });
  const { data: allViewers = [] } = useCommentViewers({ enabled: open });
  const { mutate, isPending: isSaving } = useCreateInternComment();

  const [content, setContent] = useState('');
  const [visibleTo, setVisibleTo] = useState([]);
  const [visibleToIntern, setVisibleToIntern] = useState(false);

  const internName = intern?.user?.fullname || 'this intern';

  // You are never in your own audience list — you wrote the note.
  const viewers = useMemo(
    () => allViewers.filter((viewer) => resolveUserId(viewer) !== user?._id),
    [allViewers, user?._id]
  );

  // Reset per open, so the previous intern's draft is never posted against the
  // next one the picker lands on — including the audience, which is the half that
  // would matter.
  useEffect(() => {
    if (open) {
      setContent('');
      setVisibleTo([]);
      setVisibleToIntern(false);
    }
  }, [open, internUserId]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!content.trim()) return;

    mutate(
      { userId: internUserId, payload: { content: content.trim(), visibleTo, visibleToIntern } },
      {
        onSuccess: () => {
          toast.success(`Note added for ${internName}`);
          onClose();
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to add note'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New note — {internName}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <AutoTextarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            placeholder="What happened, and what should the next person to read this know…"
            aria-label={`Add a note about ${internName}`}
            data-test="dashboard-note-content-input"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <SharedWithMenu
              viewers={viewers}
              visibleTo={visibleTo}
              onToggle={(id) =>
                setVisibleTo((prev) =>
                  prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
                )
              }
              onClear={() => setVisibleTo([])}
              internName={intern?.user?.fullname || ''}
              visibleToIntern={visibleToIntern}
              onToggleIntern={() => setVisibleToIntern((prev) => !prev)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !content.trim()}
              data-test="dashboard-note-submit"
            >
              {isSaving ? 'Posting…' : 'Post note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
