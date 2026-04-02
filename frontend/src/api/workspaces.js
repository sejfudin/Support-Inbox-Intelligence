import apiClient from './axios';

export const getAllWorkspaces = async () => {
  const response = await apiClient.get('/workspaces/all');
  return response.data;
};

export const createWorkspace = async (data) => {
  const response = await apiClient.post('/workspaces', data);
  return response.data;
};

export const getMyWorkspaces = async () => {
  const response = await apiClient.get('/workspaces');
  return response.data;
};

export const getWorkspace = async (id) => {
  const response = await apiClient.get(`/workspaces/${id}`);
  return response.data;
};

export const updateWorkspace = async (id, data) => {
  const response = await apiClient.patch(`/workspaces/${id}`, data);
  return response.data;
};

export const inviteWorkspaceMember = async (id, data) => {
  const response = await apiClient.post(`/workspaces/${id}/invite`, data);
  return response.data;
};

export const removeWorkspaceMember = async (id, userId) => {
  const response = await apiClient.delete(`/workspaces/${id}/members/${userId}`);
  return response.data;
};

export const switchWorkspace = async (id) => {
  const response = await apiClient.post(`/workspaces/${id}/switch`);
  return response.data;
};

export const deleteWorkspace = async (id) => {
  const response = await apiClient.delete(`/workspaces/${id}`);
  return response.data;
};
