import apiClient from './axios';

export const getTaskStatuses = async (workspaceId) => {
  const response = await apiClient.get('/task-statuses', {
    params: workspaceId ? { workspaceId } : undefined,
  });
  return response.data;
};

export const createTaskStatus = async ({ label, color, isBacklog, tracksTime, isDone, workspaceId }) => {
  const response = await apiClient.post('/task-statuses', {
    label,
    color,
    isBacklog,
    tracksTime,
    isDone,
    workspaceId,
  });
  return response.data;
};

export const updateTaskStatus = async (id, data) => {
  const response = await apiClient.patch(`/task-statuses/${id}`, data);
  return response.data;
};

export const deleteTaskStatus = async (id) => {
  const response = await apiClient.delete(`/task-statuses/${id}`);
  return response.data;
};

export const reorderTaskStatuses = async ({ workspaceId, orderedIds }) => {
  const response = await apiClient.patch('/task-statuses/reorder', { workspaceId, orderedIds });
  return response.data;
};
