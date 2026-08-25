import apiClient from './axios';

export const getUsers = async ({
  page = 1,
  limit = 10,
  search = '',
  pagination = true,
  workspaceId,
  roles,
  status,
  hubId,
  includeTestAccounts,
}) => {
  const response = await apiClient.get('/admin/users', {
    params: {
      page,
      limit,
      search,
      pagination,
      workspaceId,
      roles,
      status,
      hubId,
      includeTestAccounts,
    },
  });
  return response.data;
};

export const getUser = async (id) => {
  const response = await apiClient.get(`/admin/users/${id}`);
  return response.data;
};

export const sendMentorNote = async (userId, body) => {
  const response = await apiClient.post(`/users/${userId}/mentor-notes`, { body });
  return response.data;
};
