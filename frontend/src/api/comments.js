import apiClient from "./axios";

export const getCommentsByTicket = async(ticketId) => {
  await new Promise(resolve => setTimeout(resolve, 3000));

    const response = await apiClient.get(`/comment/${ticketId}`);
    return response.data;
};

export const createComment = async({ticketId, content}) => {
    const response = await apiClient.post('/comment', {ticket: ticketId, content});
    return response.data;
};

export const updateComment = async(commentId, content) => {
    const response = await apiClient.put('/comment', {commentId, content});
    return response.data;
};

export const deleteComment = async(commentId) => {
    const response = await apiClient.delete('/comment', {commentId});
    return response.data;
};