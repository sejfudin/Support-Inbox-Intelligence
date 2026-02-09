import apiClient from './axios';

export const getUsers = async ({ page = 1, limit = 10, search = "", pagination=true }) => {
  const response = await apiClient.get("/admin/users", {
    params: { page, limit, search, pagination},
  });
  return response.data;
};