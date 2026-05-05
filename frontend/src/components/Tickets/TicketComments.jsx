import { useState } from 'react';
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

export default function TicketComments({ ticketId, isArchived }) {
  const { user } = useAuth();
  const [commentToDelete, setCommentToDelete] = useState(null);
  const { data: comments = [], isLoading } = useComments(ticketId);
  const deleteMutation = useDeleteComment(ticketId);
  const commentCount = comments?.length ?? 0;

  const handleConfirmDelete = () => {
    deleteMutation.mutate(commentToDelete, {
      onSuccess: () => {
        toast.success('Comment deleted');
        setCommentToDelete(null);
      },
    });
  };

  if (isLoading) return <CommentsSkeleton />;

  return (
    <Accordion
      type="single"
      collapsible
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <AccordionItem value="activity" className="border-none">
        <AccordionTrigger className="px-4 py-3 border-b border-gray-50 bg-gray-50/30 gap-2 hover:no-underline hover:bg-gray-50/60">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
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
          <ScrollArea className="max-h-[480px] p-6">
            {comments.length === 0 ? (
              <div className="flex items-center justify-center text-sm text-gray-400 italic py-8">
                No comments yet.
              </div>
            ) : (
              <div className="space-y-6">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment._id}
                    comment={comment}
                    ticketId={ticketId}
                    user={user}
                    isArchived={isArchived}
                    onOpenDelete={setCommentToDelete}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {!isArchived && <CommentInput ticketId={ticketId} />}
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
