import { useState } from 'react';
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
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { HistoryPanel } from '@/components/interns/HistoryPanel';
import { useCommentViewers, useCreateInternComment, useInternComments } from '@/queries/interns';
import { canWriteInternMentorData } from '@/helpers/roles';
import { getInitials } from '@/helpers/getInitials';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function InternCommentsPanel({ userId, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && canWriteInternMentorData(user?.role);
  const { data: comments = [], isPending } = useInternComments(userId);
  const { data: viewers = [] } = useCommentViewers({ enabled: canWrite });
  const { mutate, isPending: isSaving } = useCreateInternComment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailComment, setDetailComment] = useState(null);
  const [content, setContent] = useState('');
  const [visibleTo, setVisibleTo] = useState([]);

  const resetForm = () => {
    setContent('');
    setVisibleTo([]);
  };

  const openDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const toggleViewer = (id) => {
    setVisibleTo((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    mutate(
      { userId, payload: { content: content.trim(), visibleTo } },
      {
        onSuccess: () => {
          resetForm();
          setDialogOpen(false);
          toast.success('Comment added');
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to add comment'),
      }
    );
  };

  const roleTag = (role) => {
    if (role === 'mentor') return { label: 'Mentor', color: 'indigo' };
    if (role === 'leadership') return { label: 'Leadership', color: 'slate' };
    if (role === 'admin') return { label: 'Admin', color: 'slate' };
    return { label: role || 'Note', color: 'slate' };
  };

  const ordered = [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const cards = ordered.map((comment, index) => ({
    id: comment._id,
    raw: comment,
    featured: index === 0,
    tag: roleTag(comment.author?.role),
    title: format(new Date(comment.createdAt), 'MMM d, yyyy'),
    avatar: {
      initials: getInitials(comment.author?.fullname),
      name: comment.author?.fullname ?? 'Unknown',
    },
    blocks: [
      {
        kind: 'chips',
        label: 'Shared with',
        items: (comment.visibleTo || []).map((viewer) => viewer?.fullname).filter(Boolean),
      },
    ],
    note: comment.content,
    sortVals: {
      date: new Date(comment.createdAt).getTime(),
      author: comment.author?.fullname ?? '',
    },
  }));

  const subtitle = `${cards.length} note${cards.length === 1 ? '' : 's'}`;

  return (
    <div className="space-y-6">
      <HistoryPanel
        title="Mentor notes"
        subtitle={subtitle}
        buttonLabel="New note"
        canWrite={canWrite}
        isLoading={isPending}
        cards={cards}
        sortOptions={[
          { key: 'date', label: 'Date' },
          { key: 'author', label: 'Author' },
        ]}
        onNew={openDialog}
        onReadMore={(id) => setDetailComment(cards.find((c) => c.id === id)?.raw)}
        onCardClick={(card) => setDetailComment(card.raw)}
        emptyMessage="No comments you can view yet."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New mentor note</DialogTitle>
            <DialogDescription>
              Interns cannot see mentor notes. Choose who else may read this comment.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="mentor-comment-content">Comment</Label>
              <AutoTextarea
                id="mentor-comment-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                data-test="intern-comment-content-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Visible to</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {viewers
                  .filter((v) => v._id !== user?._id && v.id !== user?._id)
                  .map((viewer) => {
                    const id = viewer._id || viewer.id;
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={visibleTo.includes(id)}
                          onCheckedChange={() => toggleViewer(id)}
                          data-test={`intern-comment-viewer-${id}-checkbox`}
                        />
                        <span>
                          {viewer.fullname}{' '}
                          <span className="text-muted-foreground">({viewer.role})</span>
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !content.trim()}
                data-test="intern-comment-submit-button"
              >
                {isSaving ? 'Saving...' : 'Add comment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailComment)}
        onOpenChange={(open) => !open && setDetailComment(null)}
      >
        <DialogContent
          className="max-w-lg overflow-hidden"
          data-test="intern-comment-detail-dialog"
        >
          {detailComment && (
            <>
              <DialogHeader className="min-w-0">
                <DialogTitle>{detailComment.author?.fullname ?? 'Mentor note'}</DialogTitle>
                <DialogDescription>
                  {format(new Date(detailComment.createdAt), 'MMM d, yyyy')}
                </DialogDescription>
              </DialogHeader>
              <div className="min-w-0 space-y-4">
                <p className="whitespace-pre-line text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
                  {detailComment.content}
                </p>
                {detailComment.visibleTo?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Shared with</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailComment.visibleTo
                        .filter((viewer) => viewer?.fullname)
                        .map((viewer) => (
                          <span
                            key={viewer._id || viewer.id}
                            className="rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground"
                          >
                            {viewer.fullname}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetailComment(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
