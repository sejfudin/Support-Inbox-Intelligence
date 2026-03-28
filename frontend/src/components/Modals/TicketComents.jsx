import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Avatar } from "../Avatar";
import { useComments, useCreateComment } from "@/queries/comments"; 
import CommentsSkeleton from "../Skeletons/CommentsSkeleton";

export default function TicketComments({ticketId}) {

    const [newComment, setNewComment] = useState("");
    const { data: comments, isLoading } = useComments(ticketId);
    const createMutation = useCreateComment();

    const handleSend = () => {
        if (!newComment.trim()) return;

        createMutation.mutate(
            { ticketId, content: newComment },
            {
                onSuccess: () => {
                    setNewComment(""); 
                },
            }
        );
    };

    if (isLoading) {
        return <CommentsSkeleton/>;
    } 

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-50 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Activity
            </span>
            </div>
            <ScrollArea className="flex-1 p-4">
                {comments.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                        No comments yet.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <div key={comment._id} className="flex gap-4 group transition-colors hover:bg-gray-50/50 p-2 rounded-lg">
                                <div className="flex-shrink-0 mt-1">
                                    <Avatar users={[comment.author]} />
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-gray-900 truncate">
                                            {comment.author?.fullname}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                                            {comment.createdAt && new Date(comment.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 leading-relaxed break-words">
                                        {comment.content}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>

            <div className="p-4 border-t border-gray-100 bg-white">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    disabled={createMutation.isPending}
                    className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm outline-none transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100 resize-none"
                />
                
                <div className="flex justify-end">
                    <button 
                        disabled={!newComment.trim() || createMutation.isPending}
                        onClick={handleSend} // POVEZANO SA HANDLE SEND
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                            !newComment.trim() || createMutation.isPending
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                        }`}
                    >
                        {createMutation.isPending ? "Posting..." : "Post Comment"}
                    </button>
                </div>
            </div>
        </div>
    );
}