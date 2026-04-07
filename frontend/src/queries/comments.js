import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getCommentsByTicket,
    createComment,
    updateComment,
    deleteComment,
} from '@/api/comments';

export const useComments = (ticketId) => {
    return useQuery({
        queryKey: ["comments", ticketId],
        queryFn: () => getCommentsByTicket(ticketId),
        enabled: !!ticketId,
    });
};

export const useCreateComment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createComment,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["comments", variables.ticketId] });
        },
    });
};

export const useUpdateComment = (ticketId) => {
    const queryClient = useQueryClient();
    return useMutation({ 
        mutationFn: ({ commentId, content }) => updateComment(commentId, content),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
        },
    });
};

export const useDeleteComment = (ticketId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
    },
  });
};