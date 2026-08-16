import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare } from 'lucide-react';
import { useComments, useDeleteComment } from '@/queries/comments';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '../Modals/DeleteConfirmModal';
import { CommentItem } from './CommentItem';
import { CommentInput } from './CommentInput';
import CommentsSkeleton from '../Skeletons/CommentsSkeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function TicketComments({
  ticketId,
  isArchived,
  users = [],
  focusCommentId = null,
  focusRequestToken = null,
  onFocusConsumed = null,
}) {
  const { user } = useAuth();
  const [commentToDelete, setCommentToDelete] = useState(null);
  const { data: comments = [], isLoading, isFetching, refetch } = useComments(ticketId);
  const deleteMutation = useDeleteComment(ticketId);
  const onFocusConsumedRef = useRef(onFocusConsumed);
  const lastFocusRefetchTokenRef = useRef(null);

  const [openSection, setOpenSection] = useState('activity');
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  const commentCount = comments?.length ?? 0;
  // `max-h`, not a fixed `h`: the old ladder reserved 260px for a single comment
  // and up to 480px for five, so the section was mostly empty space and pushed
  // the composer off-screen. Now it grows with the thread and caps at 260px.
  const commentsAreaHeightClass =
    commentCount === 0 ? 'max-h-[64px]' : commentCount <= 2 ? 'max-h-[180px]' : 'max-h-[260px]';

  const handleConfirmDelete = () => {
    deleteMutation.mutate(commentToDelete, {
      onSuccess: () => {
        toast.success('Comment deleted');
        setCommentToDelete(null);
      },
    });
  };

  useEffect(() => {
    onFocusConsumedRef.current = onFocusConsumed;
  }, [onFocusConsumed]);

  useEffect(() => {
    if (!focusCommentId) return;
    if (isLoading) return;
    if (!comments?.length) return;

    const exists = comments.some((c) => String(c._id) === String(focusCommentId));
    if (!exists) return;

    setOpenSection('activity');

    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-comment-id="${focusCommentId}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedCommentId(String(focusCommentId));
      onFocusConsumedRef.current?.();
      window.setTimeout(() => setHighlightedCommentId(null), 1800);
    });
  }, [focusCommentId, focusRequestToken, isLoading, comments]);

  useEffect(() => {
    if (!focusCommentId || !focusRequestToken) return;
    if (isLoading || isFetching) return;

    const exists = comments.some((c) => String(c._id) === String(focusCommentId));
    if (exists) return;

    if (lastFocusRefetchTokenRef.current === focusRequestToken) return;
    lastFocusRefetchTokenRef.current = focusRequestToken;
    refetch();
  }, [focusCommentId, focusRequestToken, comments, isLoading, isFetching, refetch]);

  if (isLoading) return <CommentsSkeleton />;

  return (
    <Accordion
      type="single"
      collapsible
      value={openSection}
      onValueChange={(v) => setOpenSection(v || '')}
      className="w-full"
    >
      {/* No card of its own: in the mockup comments are a labelled block inside
          the modal's content column, not a bordered panel nested in one. */}
      <AccordionItem value="activity" className="border-none">
        <AccordionTrigger
          className="gap-2 py-0 pb-2 hover:no-underline"
          data-test="ticket-comments-accordion-trigger"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.07em] text-muted-foreground/75">
            <MessageSquare className="h-3 w-3" aria-hidden />
            COMMENTS
            {commentCount > 0 ? ` · ${commentCount}` : ''}
          </span>
        </AccordionTrigger>

        <AccordionContent className="p-0 data-[state=closed]:hidden">
          <ScrollArea className={commentsAreaHeightClass}>
            <div className="pr-2">
              {comments.length === 0 ? (
                <p className="py-2 text-[12.5px] text-muted-foreground/75">No comments yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {comments.map((comment) => (
                    <div
                      key={comment._id}
                      data-comment-id={comment._id}
                      className={
                        highlightedCommentId === String(comment._id)
                          ? 'rounded-[var(--r-tile)] ring-2 ring-[hsl(var(--tone-info)/0.3)] bg-[hsl(var(--tone-info)/0.4)] transition'
                          : ''
                      }
                    >
                      <CommentItem
                        key={comment._id}
                        comment={comment}
                        ticketId={ticketId}
                        user={user}
                        isArchived={isArchived}
                        onOpenDelete={setCommentToDelete}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {!isArchived && (
            <div className="pt-2.5">
              <CommentInput ticketId={ticketId} users={users} />
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      <DeleteConfirmModal
        isOpen={!!commentToDelete}
        onClose={() => setCommentToDelete(null)}
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isPending}
        title="Delete Comment"
        description="Are you sure you want to delete this comment?"
      />
    </Accordion>
  );
}
