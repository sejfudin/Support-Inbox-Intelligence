import { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, AlertCircle, ImagePlus, X } from 'lucide-react';
import { useCreateComment } from '@/queries/comments';
import { uploadCommentImages as uploadCommentImagesApi } from '@/api/comments';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const CommentInput = ({ ticketId }) => {
  const [newComment, setNewComment] = useState('');
  const MAX_CHARS = 1000;
  const createMutation = useCreateComment();
  const queryClient = useQueryClient();

  const isNearLimit = newComment.length > MAX_CHARS * 0.9;
  const isAtLimit = newComment.length == MAX_CHARS;

  // supabase
  const fileInputRef = useRef(null);
  const [selectedImages, setSelectedImages] = useState([]);

  const validateClientFiles = (files) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    for (const f of files) {
      if (!allowed.has(f.type)) {
        toast.error('Only JPG, PNG, and WEBP are allowed.');
        return false;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error('Each image must be 5MB or smaller.');
        return false;
      }
    }
    return true;
  };

  const handlePickImages = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (!validateClientFiles(files)) return;

    const next = [...selectedImages, ...files].slice(0, 3);
    if (selectedImages.length + files.length > 3) {
      toast.error('Maximum 3 images per comment.');
    }
    setSelectedImages(next);
  };

  const removeSelectedImage = (idx) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = () => {
    if ((!newComment.trim() && selectedImages.length === 0) || createMutation.isPending) return;
    if (newComment.length > MAX_CHARS) return;

    createMutation.mutate(
      { ticketId, content: newComment || '(attachment)' },
      {
        onSuccess: async (createdComment) => {
          try {
            if (selectedImages.length > 0) {
              await uploadCommentImagesApi(createdComment._id, selectedImages);
              queryClient.invalidateQueries({
                queryKey: ['comment-images', createdComment._id],
              });
              queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
            }
            setNewComment('');
            setSelectedImages([]);
            toast.success('Comment posted');
          } catch (err) {
            toast.error(err?.response?.data?.message || 'Comment created, image upload failed.');
          }
        },
        onError: (err) => {
          toast.error(err?.response?.data?.message || 'Failed to post comment');
        },
      }
    );
  };

  const handleCommentKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return;
    if (e.nativeEvent?.isComposing) return;

    e.preventDefault();
    handleSend();
  };

  return (
    <div className="p-5 border-t border-gray-120 bg-white">
      <div className="relative group/input">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleCommentKeyDown}
          placeholder="Write a comment..."
          disabled={createMutation.isPending}
          maxLength={MAX_CHARS}
          className={cn(
            'min-h-[80px] bg-gray-50/50 border-gray-200 focus-visible:ring-blue-500 resize-none pr-12 transition-all',
            isAtLimit && 'border-orange-400 focus-visible:ring-orange-400'
          )}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handlePickImages}
        />

        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={createMutation.isPending || selectedImages.length >= 3}
            className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Add Images ({selectedImages.length}/3)
          </button>
        </div>

        {selectedImages.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {selectedImages.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="relative rounded-md border overflow-hidden"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-20 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeSelectedImage(idx)}
                  className="absolute top-1 right-1 rounded bg-white/90 p-1"
                >
                  <X className="w-3 h-3 text-red-600" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'absolute -top-5 right-1 text-[11px] font-semibold transition-colors flex items-center gap-1',
            isAtLimit ? 'text-orange-600' : isNearLimit ? 'text-amber-500' : 'text-gray-400'
          )}
        >
          {isAtLimit && <AlertCircle className="w-3 h-3" />}
          {newComment.length} / {MAX_CHARS}
        </div>

        <div className="absolute -bottom-1 right-1  flex items-center gap-2">
          <Button
            size="icon"
            disabled={
              (!newComment.trim() && selectedImages.length === 0) ||
              isAtLimit ||
              createMutation.isPending
            }
            onClick={handleSend}
            className={cn(
              'h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95',
              isAtLimit && 'bg-orange-500 hover:bg-orange-600'
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
