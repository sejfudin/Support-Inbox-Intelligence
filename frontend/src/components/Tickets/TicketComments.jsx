import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button"; // Shadcn Button
import { Textarea } from "@/components/ui/textarea"; // Shadcn Textarea
import { Avatar } from "../Avatar";
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from "@/queries/comments"; 
import CommentsSkeleton from "../Skeletons/CommentsSkeleton";
import { Trash2, Edit2, X, Check, MessageSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { DeleteConfirmModal } from "../Modals/DeleteConfirmModal";

export default function TicketComments({ ticketId, isArchived }) {
    const { user } = useAuth();
    const [newComment, setNewComment] = useState("");
    
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState("");

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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
    };

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setCommentToDelete(null);
    };

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
        <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Activity</span>
            </div>

            <ScrollArea className="flex-1 p-4">
                {comments.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400 italic">No comments yet.</div>
                ) : (
                    <div className="space-y-6">
                        {comments.map((comment) => {
                            const isAuthor = user?._id === comment.author?._id;
                            const isAdmin = user?.role === 'admin';
                            const isEditing = editingId === comment._id;

                            return (
                                <div key={comment._id} className="flex gap-4 group transition-all">
                                    <div className="flex-shrink-0">
                                        <Avatar users={[comment.author]} className="w-8 h-8" />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex items-center justify-between group/header">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-sm font-semibold text-gray-900 truncate">
                                                    {comment.author?.fullname}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(comment.createdAt).toLocaleDateString()}
                                                    {comment.isEdited && <span className="ml-1 italic opacity-70">(edited)</span>}
                                                </span>
                                            </div>

                                            {!isArchived && !isEditing && (
                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {isAuthor && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7 text-gray-400 hover:text-blue-600"
                                                            onClick={() => { setEditingId(comment._id); setEditContent(comment.content); }}
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                    {(isAuthor || isAdmin) && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7 text-gray-400 hover:text-red-500"
                                                            onClick={() => openDeleteModal(comment._id)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {isEditing ? (
                                            <div className="mt-2 space-y-2">
                                                <Textarea 
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    className="min-h-[60px] text-sm focus-visible:ring-blue-500"
                                                />
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                                                        <X className="w-4 h-4 text-gray-400" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleUpdate(comment._id)}>
                                                        <Check className="w-4 h-4 text-blue-600" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-1 text-sm text-gray-600 leading-relaxed break-words whitespace-pre-wrap">
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
                <div className="p-4 border-t border-gray-100 bg-white space-y-3">
                  <div className="relative group/input">
                    <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        disabled={createMutation.isPending}
                        className="min-h-[80px] bg-gray-50/50 border-gray-200 focus-visible:ring-blue-500 resize-none"
                    />
                  <div className="absolute bottom-2 right-2">
                    <Button 
                        size="icon"
                        disabled={!newComment.trim() || createMutation.isPending}
                        onClick={handleSend}
                        className="h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-transform active:scale-95 disabled:bg-gray-200"
                    >
                        {createMutation.isPending ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <Check className="w-4 h-4" /> 
                        )}
                    </Button>
                    </div>
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
            />
        </div>
    );
}