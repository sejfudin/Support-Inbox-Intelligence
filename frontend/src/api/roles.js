import apiClient from '@/api/axios';

export const fetchRoles = async () => {
  const { data } = await apiClient.get('/roles');
  return data;
};
