import apiClient from './axios';

export const getUsers = async ({
  page = 1,
  limit = 10,
  search = '',
  pagination = true,
  workspaceId,
}) => {
  const response = await apiClient.get('/admin/users', {
    params: { page, limit, search, pagination, workspaceId },
  });
  return response.data;
};

export const getUser = async (id) => {
  const response = await apiClient.get(`/admin/users/${id}`);
  return response.data;
};
