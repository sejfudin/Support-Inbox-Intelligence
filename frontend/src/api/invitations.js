import apiClient from './axios';

export const getMyInvitations = async () => {
  const response = await apiClient.get('/invitations/me');
  return response.data;
};

export const acceptInvitation = async (id) => {
  const response = await apiClient.post(`/invitations/${id}/accept`);
  return response.data;
};

export const declineInvitation = async (id) => {
  const response = await apiClient.post(`/invitations/${id}/decline`);
  return response.data;
};
