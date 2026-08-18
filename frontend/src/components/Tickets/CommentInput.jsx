import { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AlertCircle, ImagePlus, X } from 'lucide-react';
import { useCreateComment } from '@/queries/comments';
import { uploadCommentImages as uploadCommentImagesApi } from '@/api/comments';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCommentMentions } from '@/hooks/useCommentMentions';
import { invalidateTicketScope } from '@/lib/invalidationScopes';

export const CommentInput = ({ ticketId, users = [] }) => {
  const [newComment, setNewComment] = useState('');
  const MAX_CHARS = 1000;
  const createMutation = useCreateComment();
  const queryClient = useQueryClient();

  const isNearLimit = newComment.length > MAX_CHARS * 0.9;
  const isAtLimit = newComment.length == MAX_CHARS;

  // supabase
  const fileInputRef = useRef(null);
  const [selectedImages, setSelectedImages] = useState([]);

  const textareaRef = useRef(null);
  const {
    mentionOpen,
    mentionItems,
    mentionActiveIndex,
    applyMention,
    handleMentionChange,
    handleMentionKeyDown,
  } = useCommentMentions({
    users,
    value: newComment,
    setValue: setNewComment,
    textareaRef,
  });

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
              invalidateTicketScope(queryClient, ticketId);
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
    if (handleMentionKeyDown(e)) return;
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return;
    if (e.nativeEvent?.isComposing) return;

    e.preventDefault();
    handleSend();
  };

  return (
    <div className="rounded-[var(--r-tile)] border border-separator bg-card p-2.5">
      <div className="relative z-20 group/input">
        <Textarea
          value={newComment}
          onKeyDown={handleCommentKeyDown}
          placeholder="Write a comment..."
          disabled={createMutation.isPending}
          maxLength={MAX_CHARS}
          className={cn(
            'min-h-[52px] bg-muted/50 border-border focus-visible:ring-[hsl(var(--tone-info))] resize-none pr-12 transition-all',
            isAtLimit &&
              'border-[hsl(var(--tone-orange))] focus-visible:ring-[hsl(var(--tone-orange))]'
          )}
          ref={textareaRef}
          onChange={handleMentionChange}
          data-test="ticket-comment-input"
        />

        {mentionOpen && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-[120] rounded-[var(--r-tile)] border bg-card shadow-lg">
            {mentionItems.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No users found</div>
            ) : (
              <ul className="max-h-56 overflow-y-auto py-1">
                {mentionItems.map((item, idx) => (
                  <li key={item.userId}>
                    <button
                      type="button"
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-muted/50',
                        idx === mentionActiveIndex &&
                          'bg-[hsl(var(--tone-info)/0.15)] dark:bg-[hsl(var(--tone-info)/0.2)]'
                      )}
                      onMouseDown={(evt) => evt.preventDefault()}
                      onClick={() => applyMention(item)}
                      data-test={`ticket-comment-mention-option-${item.userId}`}
                    >
                      <div className="font-medium text-foreground">@{item.handle}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.fullname || item.email}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handlePickImages}
          data-test="ticket-comment-image-file-input"
        />

        {/* One action row inside the composer box: attach on the left, the
            character count and send on the right. The count and the send button
            used to be absolutely positioned *outside* the box (`-top-5`,
            `-bottom-1`), so once the composer got its own border they sat on top
            of it and of the comment above. */}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={createMutation.isPending || selectedImages.length >= 3}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-badge)] border border-separator px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            data-test="ticket-comment-add-images-button"
          >
            <ImagePlus className="h-3 w-3" />
            Images ({selectedImages.length}/3)
          </button>

          <span className="flex-1" />

          <span
            className={cn(
              'flex items-center gap-1 text-[11px] font-medium tabular-nums transition-colors',
              isAtLimit
                ? 'text-[hsl(var(--tone-danger-fg))]'
                : isNearLimit
                  ? 'text-[hsl(var(--tone-warning))]'
                  : 'text-muted-foreground/75'
            )}
          >
            {isAtLimit && <AlertCircle className="h-3 w-3" />}
            {newComment.length} / {MAX_CHARS}
          </span>

          <Button
            size="sm"
            disabled={
              (!newComment.trim() && selectedImages.length === 0) ||
              isAtLimit ||
              createMutation.isPending
            }
            onClick={handleSend}
            data-test="ticket-comment-send-button"
            className="h-7 rounded-[var(--r-badge)] px-3 text-[12px] font-medium"
          >
            {createMutation.isPending ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              'Send'
            )}
          </Button>
        </div>

        {selectedImages.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {selectedImages.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="relative rounded-[var(--r-tile)] border overflow-hidden"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-20 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeSelectedImage(idx)}
                  className="absolute top-1 right-1 rounded bg-card p-1"
                  data-test={`ticket-comment-remove-image-button-${idx}`}
                >
                  <X className="w-3 h-3 text-[hsl(var(--tone-danger-fg))]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {isAtLimit && (
        <p className="ml-1 mt-1.5 text-[11px] font-medium text-[hsl(var(--tone-danger-fg))]">
          You've reached maximum comment length.
        </p>
      )}
    </div>
  );
};
