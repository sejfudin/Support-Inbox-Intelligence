import apiClient from './axios';

export const getTicketStatuses = async (workspaceId) => {
  const response = await apiClient.get('/ticket-statuses', {
    params: workspaceId ? { workspaceId } : undefined,
  });
  return response.data;
};

export const createTicketStatus = async ({ label, color, isBacklog, tracksTime, isDone, workspaceId }) => {
  const response = await apiClient.post('/ticket-statuses', {
    label,
    color,
    isBacklog,
    tracksTime,
    isDone,
    workspaceId,
  });
  return response.data;
};

export const updateTicketStatus = async (id, data, workspaceId) => {
  const response = await apiClient.patch(`/ticket-statuses/${id}`, data, {
    params: workspaceId ? { workspaceId } : undefined,
  });
  return response.data;
};

export const deleteTicketStatus = async (id, workspaceId) => {
  const response = await apiClient.delete(`/ticket-statuses/${id}`, {
    params: workspaceId ? { workspaceId } : undefined,
  });
  return response.data;
};

export const reorderTicketStatuses = async ({ workspaceId, orderedIds }) => {
  const response = await apiClient.patch('/ticket-statuses/reorder', { workspaceId, orderedIds });
  return response.data;
};
