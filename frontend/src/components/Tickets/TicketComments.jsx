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
  const commentsAreaHeightClass =
    commentCount === 0
      ? 'h-[150px]'
      : commentCount <= 2
        ? 'h-[260px]'
        : commentCount <= 4
          ? 'h-[340px]'
          : 'h-[420px] sm:h-[480px]';

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
      className="bg-white rounded-2xl border border-gray-200 shadow-md"
    >
      <AccordionItem value="activity" className="border-none">
        <AccordionTrigger className="px-4 py-3 border-b border-gray-50 bg-gray-50/30 gap-2 hover:no-underline hover:bg-gray-50/60">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Comments
            </span>
            {commentCount > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 border border-gray-200">
                {commentCount}
              </span>
            )}
          </div>
        </AccordionTrigger>

        <AccordionContent className="p-0 data-[state=closed]:hidden">
          <ScrollArea className={commentsAreaHeightClass}>
            <div className="p-6">
              {comments.length === 0 ? (
                <div className="flex items-center justify-center text-sm text-gray-500 italic py-8">
                  No comments yet.
                </div>
              ) : (
                <div className="space-y-6">
                  {comments.map((comment) => (
                    <div
                      key={comment._id}
                      data-comment-id={comment._id}
                      className={
                        highlightedCommentId === String(comment._id)
                          ? 'rounded-md ring-2 ring-blue-300 bg-blue-50/40 transition'
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

          {!isArchived && <CommentInput ticketId={ticketId} users={users} />}
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
