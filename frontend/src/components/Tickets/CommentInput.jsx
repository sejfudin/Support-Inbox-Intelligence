import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle } from "lucide-react";
import { useCreateComment } from "@/queries/comments";
import { cn } from "@/lib/utils";

export const CommentInput = ({ ticketId }) => {
  const [newComment, setNewComment] = useState("");
  const MAX_CHARS = 1000;
  const createMutation = useCreateComment();

  const isNearLimit = newComment.length > MAX_CHARS * 0.9;
  const isAtLimit = newComment.length == MAX_CHARS;

  const handleSend = () => {
    if (
      !newComment.trim() ||
      newComment.length > MAX_CHARS ||
      createMutation.isPending
    )
      return;
    createMutation.mutate(
      { ticketId, content: newComment },
      {
        onSuccess: () => setNewComment(""),
      },
    );
  };

  return (
    <div className="p-4 border-t border-gray-100 bg-white">
      <div className="relative group/input">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          disabled={createMutation.isPending}
          maxLength={MAX_CHARS}
          className={cn(
            "min-h-[80px] bg-gray-50/50 border-gray-200 focus-visible:ring-blue-500 resize-none pr-12 transition-all",
            isAtLimit && "border-orange-400 focus-visible:ring-orange-400",
          )}
        />

        <div
          className={cn(
            "absolute -top-6 right-1 text-[11px] font-semibold transition-colors flex items-center gap-1",
            isAtLimit
              ? "text-orange-600"
              : isNearLimit
                ? "text-amber-500"
                : "text-gray-400",
          )}
        >
          {isAtLimit && <AlertCircle className="w-3 h-3" />}
          {newComment.length} / {MAX_CHARS}
        </div>

        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <Button
            size="icon"
            disabled={
              !newComment.trim() || isAtLimit || createMutation.isPending
            }
            onClick={handleSend}
            className={cn(
              "h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95",
              isAtLimit && "bg-orange-500 hover:bg-orange-600",
            )}
          >
            {createMutation.isPending ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
      {isAtLimit && (
        <p className="text-[10px] text-orange-600 mt-1.5 ml-1 font-medium animate-in fade-in slide-in-from-top-1">
          You've reached maximum comment length.
        </p>
      )}
    </div>
  );
};
