import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Avatar } from "../Avatar";
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from "@/queries/comments"; 
import CommentsSkeleton from "../Skeletons/CommentsSkeleton";
import { Trash2, Edit2, X, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { DeleteConfirmModal } from "../Modals/DeleteConfirmModal";

export default function TicketComments({ ticketId, isArchived }) {
    const { user } = useAuth();
    const [newComment, setNewComment] = useState("");
    
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState("");

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(null);
    const [commentToDelete, setCommentToDelete] = useState(null);

    const { data: comments = [], isLoading } = useComments(ticketId);
    const createMutation = useCreateComment();
    const updateMutation = useUpdateComment(ticketId);
    const deleteMutation = useDeleteComment(ticketId);

    const handleSend = () => {
        if (!newComment.trim()) return;
        createMutation.mutate({ ticketId, content: newComment }, {
            onSuccess: () => setNewComment(""),
        });
    };

    const handleUpdate = (commentId) => {
        if (!editContent.trim()) return;
        updateMutation.mutate({ commentId, content: editContent }, {
            onSuccess: () => {
                setEditingId(null);
                toast.success("Comment updated");
            }
        });
    };

    const openDeleteModal = (commentId) => {
        setCommentToDelete(commentId);
        setIsDeleteModalOpen(true);
    }

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setCommentToDelete(null);
    }

    const handleConfirmDelete = () => {
        if (!commentToDelete) return;

        deleteMutation.mutate(commentToDelete, {
            onSuccess: () => {
                toast.success("Comment deleted");
                closeDeleteModal();
            },
            onError: (error) => {
                toast.error(error?.response?.data?.message || "Could not delete comment");
            }
        });
    };

    if (isLoading) return <CommentsSkeleton />;

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-50 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Activity</span>
            </div>

            <ScrollArea className="flex-1 p-4">
                {comments.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500 italic">No comments yet.</div>
                ) : (
                    <div className="space-y-4">
                        {comments.map((comment) => {
                            const isAuthor = user?._id === comment.author?._id;
                            const isAdmin = user?.role === 'admin';
                            const isEditing = editingId === comment._id;

                            return (
                                <div key={comment._id} className="flex gap-4 group p-2 rounded-lg transition-colors hover:bg-gray-50/50">
                                    <div className="flex-shrink-0 mt-1">
                                        <Avatar users={[comment.author]} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-gray-900 truncate">
                                                    {comment.author?.fullname}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    {new Date(comment.createdAt).toLocaleDateString()}
                                                    {comment.isEdited && <span className="ml-1 text-[9px] italic text-gray-300">(edited)</span>}
                                                </span>
                                            </div>

                                            {!isArchived && !isEditing && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {isAuthor && (
                                                        <button 
                                                            onClick={() => { setEditingId(comment._id); setEditContent(comment.content); }}
                                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {(isAuthor || isAdmin) && (
                                                        <button 
                                                            onClick={() => openDeleteModal(comment._id)}
                                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <textarea 
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    className="w-full p-2 text-sm border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                                    rows={2}
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                                                    <button onClick={() => handleUpdate(comment._id)} className="p-1 text-blue-600 hover:text-blue-700"><Check className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-gray-600 leading-relaxed break-words whitespace-pre-wrap">
                                                {comment.content}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>

            {!isArchived && (
                <div className="p-4 border-t border-gray-100 bg-white">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        disabled={createMutation.isPending}
                        className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm outline-none transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100 resize-none"
                    />
                    <div className="flex justify-end mt-2">
                        <button 
                            disabled={!newComment.trim() || createMutation.isPending}
                            onClick={handleSend}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                                !newComment.trim() || createMutation.isPending ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                            }`}
                        >
                            {createMutation.isPending ? "Posting..." : "Post Comment"}
                        </button>
                    </div>
                </div>
            )}
            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={handleConfirmDelete}
                isLoading={deleteMutation.isPending}
                title="Delete Comment"
                description="Are you sure you want to delete this comment? This action cannot be undone."
                confirmLabel="Delete"
                loadingLabel="Deleting..."
            />
        </div>
    );
}