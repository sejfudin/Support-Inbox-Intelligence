import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCommentsByTicket,
  createComment,
  updateComment,
  deleteComment,
  getCommentImages,
  uploadCommentImages,
  deleteCommentImage,
} from '@/api/comments';

export const useComments = (ticketId) => {
  return useQuery({
    queryKey: ['comments', ticketId],
    queryFn: () => getCommentsByTicket(ticketId),
    enabled: !!ticketId,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createComment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-history', variables.ticketId] });
    },
  });
};

export const useUpdateComment = (ticketId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }) => updateComment(commentId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
    },
  });
};

export const useDeleteComment = (ticketId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
    },
  });
};

export const useCommentImages = (commentId) => {
  return useQuery({
    queryKey: ['comment-images', commentId],
    queryFn: () => getCommentImages(commentId),
    enabled: !!commentId,
  });
};

export const useUploadCommentImages = (commentId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files) => uploadCommentImages(commentId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comment-images', commentId] });
    },
  });
};

export const useDeleteCommentImage = (commentId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId) => deleteCommentImage(commentId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comment-images', commentId] });
    },
  });
};
