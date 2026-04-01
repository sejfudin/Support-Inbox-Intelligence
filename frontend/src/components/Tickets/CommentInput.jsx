import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useCreateComment } from "@/queries/comments";

export const CommentInput = ({ ticketId }) => {
    const [newComment, setNewComment] = useState("");
    const createMutation = useCreateComment();

    const handleSend = () => {
        if (!newComment.trim()) return;
        createMutation.mutate({ ticketId, content: newComment }, {
            onSuccess: () => setNewComment(""),
        });
    };

    return (
        <div className="p-4 border-t border-gray-100 bg-white">
            <div className="relative group/input">
                <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    disabled={createMutation.isPending}
                    className="min-h-[80px] bg-gray-50/50 border-gray-200 focus-visible:ring-blue-500 resize-none pr-12"
                />
                <div className="absolute bottom-2 right-2">
                    <Button 
                        size="icon"
                        disabled={!newComment.trim() || createMutation.isPending}
                        onClick={handleSend}
                        className="h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-transform active:scale-95"
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
    );
};