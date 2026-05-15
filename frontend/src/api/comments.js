import apiClient from './axios';

export const getCommentsByTicket = async (ticketId) => {
  const response = await apiClient.get(`/comment/${ticketId}`);
  return response.data;
};

export const createComment = async ({ ticketId, content }) => {
  const response = await apiClient.post('/comment', { ticket: ticketId, content });
  return response.data;
};

export const updateComment = async (commentId, content) => {
  const response = await apiClient.put('/comment', { commentId, content });
  return response.data;
};

export const deleteComment = async (commentId) => {
  const response = await apiClient.delete('/comment', { data: { commentId } });
  return response.data;
};

// supabase
export const getCommentImages = async (commentId) => {
  const res = await apiClient.get(`/comment/${commentId}/images`);
  return res.data;
};

export const uploadCommentImages = async (commentId, files) => {
  const fd = new FormData();
  files.forEach((f) => fd.append('images', f));
  const res = await apiClient.post(`/comment/${commentId}/images`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deleteCommentImage = async (commentId, imageId) => {
  const res = await apiClient.delete(`/comment/${commentId}/images/${imageId}`);
  return res.data;
};
