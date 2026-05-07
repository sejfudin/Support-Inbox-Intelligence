import { useState } from 'react';
import { Avatar } from '../Avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Edit2, Trash2, X, Check } from 'lucide-react';
import { useUpdateComment, useDeleteComment, useCommentImages, useDeleteCommentImage } from '@/queries/comments';
import { toast } from 'sonner';
import { format } from 'date-fns';

export const CommentItem = ({ comment, ticketId, user, isArchived, onOpenDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const updateMutation = useUpdateComment(ticketId);
  const isAuthor = user?._id === comment.author?._id;
  const isAdmin = user?.role === 'admin';
  const isDeleted = comment.isDeleted;

  // supabase
  const { data: commentImagesRes } = useCommentImages(comment._id);
  const commentImages = commentImagesRes?.data || [];
  const deleteCommentImageMutation = useDeleteCommentImage(comment._id);

  const handleDeleteCommentImage = (imageId) => {
    deleteCommentImageMutation.mutate(imageId, {
      onSuccess: () => toast.success('Comment image deleted'),
      onError: (err) =>
        toast.error(err?.response?.data?.message || 'Failed to delete comment image'),
    });
  };

  const handleUpdate = () => {
    const trimmedContent = editContent.trim();

    if (!trimmedContent) return;

    if (trimmedContent === comment.content) {
      setIsEditing(false);
      return;
    }

    updateMutation.mutate(
      { commentId: comment._id, content: trimmedContent },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success('Comment updated');
        },
      }
    );
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditContent(comment.content);
  };

  return (
    <div className={`flex gap-4 group/comment transition-all ${isDeleted ? 'opacity-60' : ''}`}>
      <div className="flex-shrink-0">
        <Avatar users={[comment.author]} className={`w-8 h-8 ${isDeleted ? 'grayscale' : ''}`} />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-900 leading-tight">
              {comment.author?.fullname}
            </span>

            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 leading-none">
              <span>{format(new Date(comment.createdAt), "MMM d, yyyy 'at' HH:mm")}</span>
              {!isDeleted && comment.isEdited && (
                <>
                  <span className="text-[8px] opacity-40">•</span>
                  <TooltipProvider>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <span className="italic cursor-pointer hover:text-blue-500 transition-colors">
                          (edited)
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[11px]">
                        <p>
                          Edited: {format(new Date(comment.updatedAt), "MMM d, yyyy 'at' HH:mm")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>
          </div>

          {!isArchived && !isEditing && !isDeleted && (
            <div className="flex items-center opacity-0 invisible group-hover/comment:opacity-100 group-hover/comment:visible pointer-events-none group-hover/comment:pointer-events-auto">
              {isAuthor && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-blue-600"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              )}
              {(isAuthor || isAdmin) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-red-500"
                  onClick={() => onOpenDelete(comment._id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2 w-full p-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px] text-sm focus-visible:ring-blue-500 w-full resize-none"
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
          <div
            className={`mt-1 text-sm leading-relaxed whitespace-pre-wrap [word-break:break-word] break-words ${
              isDeleted ? 'text-gray-400 italic font-medium py-1' : 'text-gray-600'
            }`}
          >
            {isDeleted ? (
              <span className="flex items-center gap-1.5 italic">
                <Trash2 className="w-3 h-3 opacity-50" />
                This comment was deleted
              </span>
            ) : (
              comment.content
            )}
          </div>
        )}

        {!isDeleted && commentImages.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {commentImages.map((img) => (
              <div key={img.id} className="relative rounded-md border overflow-hidden group">
                <img
                  src={img.image_url}
                  alt={img.original_file_name || 'Comment image'}
                  className="w-full h-36 object-cover cursor-zoom-in"
                  onClick={() => setPreviewImageUrl(img.image_url)}
                />
                {!isArchived && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCommentImage(img.id)}
                    className="absolute top-1 right-1 bg-white/90 rounded p-1 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {previewImageUrl && (
          <div
            className="fixed inset-0 z-[220] bg-black/85 flex items-center justify-center p-4"
            onClick={() => setPreviewImageUrl(null)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 rounded-full bg-white/90 p-2"
              onClick={() => setPreviewImageUrl(null)}
              aria-label="Close image preview"
            >
              <X className="w-5 h-5 text-gray-900" />
            </button>
            <img
              src={previewImageUrl}
              alt="Comment preview"
              className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

      </div>
    </div>
  );
};
