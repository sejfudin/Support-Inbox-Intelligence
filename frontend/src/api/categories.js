import apiClient from './axios';

export const getCategories = async (workspaceId) => {
  const response = await apiClient.get('/categories', {
    params: workspaceId ? { workspaceId } : undefined,
  });
  return response.data;
};

export const createCategory = async ({ name, color, workspaceId }) => {
  const response = await apiClient.post('/categories', { name, color, workspaceId });
  return response.data;
};

export const updateCategory = async (id, { name, color }) => {
  const response = await apiClient.patch(`/categories/${id}`, { name, color });
  return response.data;
};

export const deleteCategory = async (id) => {
  const response = await apiClient.delete(`/categories/${id}`);
  return response.data;
};
