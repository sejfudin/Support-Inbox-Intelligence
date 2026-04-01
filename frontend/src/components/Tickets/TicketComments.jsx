import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare } from "lucide-react";
import { useComments, useDeleteComment } from "@/queries/comments"; 
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { DeleteConfirmModal } from "../Modals/DeleteConfirmModal";
import { CommentItem } from "./CommentItem";
import { CommentInput } from "./CommentInput";
import CommentsSkeleton from "../Skeletons/CommentsSkeleton";

export default function TicketComments({ ticketId, isArchived }) {
    const { user } = useAuth();
    const [commentToDelete, setCommentToDelete] = useState(null);
    const { data: comments = [], isLoading } = useComments(ticketId);
    const deleteMutation = useDeleteComment(ticketId);

    const handleConfirmDelete = () => {
        deleteMutation.mutate(commentToDelete, {
            onSuccess: () => {
                toast.success("Comment deleted");
                setCommentToDelete(null);
            },
        });
    };

    if (isLoading) return <CommentsSkeleton />;

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Activity</span>
            </div>

            {/* List Section */}
            <ScrollArea className="flex-1 p-4">
                {comments.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400 italic">No comments yet.</div>
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

            {/* Input Section */}
            {!isArchived && <CommentInput ticketId={ticketId} />}

            <DeleteConfirmModal
                isOpen={!!commentToDelete}
                onClose={() => setCommentToDelete(null)}
                onConfirm={handleConfirmDelete}
                isLoading={deleteMutation.isPending}
                title="Delete Comment"
                description="Are you sure you want to delete this comment?"
            />
        </div>
    );
}