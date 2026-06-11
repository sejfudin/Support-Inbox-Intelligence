import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { InternPanel } from '@/components/interns/InternPanel';
import { useCommentViewers, useCreateInternComment, useInternComments } from '@/queries/interns';
import { canWriteInternMentorData } from '@/helpers/roles';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function InternCommentsPanel({ userId, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && canWriteInternMentorData(user?.role);
  const { data: comments = [], isPending } = useInternComments(userId);
  const { data: viewers = [] } = useCommentViewers({ enabled: canWrite });
  const { mutate, isPending: isSaving } = useCreateInternComment();

  const [content, setContent] = useState('');
  const [visibleTo, setVisibleTo] = useState([]);

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
          setContent('');
          setVisibleTo([]);
          toast.success('Comment added');
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to add comment'),
      }
    );
  };

  return (
    <div className="space-y-6">
      {canWrite && (
        <InternPanel>
          <h3 className="text-lg font-semibold">Add private note</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Interns cannot see mentor notes. Choose who else may read this comment.
          </p>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="mentor-comment-content">Comment</Label>
              <Textarea
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
            <Button
              type="submit"
              disabled={isSaving || !content.trim()}
              data-test="intern-comment-submit-button"
            >
              {isSaving ? 'Saving...' : 'Add comment'}
            </Button>
          </form>
        </InternPanel>
      )}

      <InternPanel>
        <h3 className="text-lg font-semibold">Mentor notes</h3>
        {isPending && <p className="mt-4 text-sm text-muted-foreground">Loading comments...</p>}
        {!isPending && comments.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No comments you can view yet.</p>
        )}
        <ul className="mt-4 space-y-4">
          {comments.map((comment) => (
            <li
              key={comment._id}
              className="rounded-xl border border-border/60 bg-muted/30 p-4"
              data-test={`intern-comment-${comment._id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{comment.author?.fullname}</span>
                <span>{format(new Date(comment.createdAt), 'MMM d, yyyy')}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {comment.content}
              </p>
              {comment.visibleTo?.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Shared with:{' '}
                  {comment.visibleTo
                    .map((v) => v.fullname)
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </InternPanel>
    </div>
  );
}
