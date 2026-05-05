import apiClient from './axios';

export const getTicketHistory = async (ticketId) => {
  const response = await apiClient.get(`/history/${ticketId}`);
  return response.data;
};
