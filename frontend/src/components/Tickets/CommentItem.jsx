import { useState } from "react";
import { Avatar } from "../Avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip"
import { Edit2, Trash2, X, Check } from "lucide-react";
import { useUpdateComment, useDeleteComment } from "@/queries/comments";
import { toast } from "sonner";
import { format } from "date-fns";

export const CommentItem = ({ comment, ticketId, user, isArchived, onOpenDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    
    const updateMutation = useUpdateComment(ticketId);
    const isAuthor = user?._id === comment.author?._id;
    const isAdmin = user?.role === "admin";

    const handleUpdate = () => {
        if (!editContent.trim()) return;
        updateMutation.mutate({ commentId: comment._id, content: editContent }, {
            onSuccess: () => {
                setIsEditing(false);
                toast.success("Comment updated");
            }
        });
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditContent(comment.content);
    }

    return (
        <div className="flex gap-4 group transition-all">
            <div className="flex-shrink-0">
                <Avatar users={[comment.author]} className="w-8 h-8" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between group/header">                  
                    <div className="flex flex-col gap-1"> 
                        <span className="text-sm font-semibold text-gray-900 leading-tight">
                            {comment.author?.fullname}
                        </span>

                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 leading-none">
                            <span>{format(new Date(comment.createdAt), "MMM d, yyyy 'at' HH:mm")}</span>
                            
                            {comment.isEdited && (
                                <>
                                    <span className="text-[8px] opacity-40">•</span>
                                    <TooltipProvider>
                                        <Tooltip delayDuration={200}>
                                            <TooltipTrigger asChild>
                                                <span className="italic cursor-help hover:text-blue-500 transition-colors">
                                                    (edited)
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-[11px]">
                                                <p>Edited: {format(new Date(comment.updatedAt), "MMM d, yyyy 'at' HH:mm")}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </>
                            )}
                        </div>
                    </div>

                    {!isArchived && !isEditing && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {isAuthor && (
                                <Button 
                                    variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-600"
                                    onClick={() => setIsEditing(true)}
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                            )}
                            {(isAuthor || isAdmin) && (
                                <Button 
                                    variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                                    onClick={() => onOpenDelete(comment._id)}
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
                            <Button variant="ghost" size="sm" onClick={() => cancelEditing()}>
                                <X className="w-4 h-4 text-gray-400" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleUpdate}>
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
};