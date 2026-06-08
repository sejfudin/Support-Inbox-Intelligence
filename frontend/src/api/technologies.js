import apiClient from '@/api/axios';

export const fetchTechnologies = async ({ includeInactive = false } = {}) => {
  const params = includeInactive ? { includeInactive: 'true' } : undefined;
  const { data } = await apiClient.get('/technologies', { params });
  return data;
};

export const createTechnology = async (payload) => {
  const { data } = await apiClient.post('/technologies', payload);
  return data;
};

export const updateTechnology = async (id, payload) => {
  const { data } = await apiClient.patch(`/technologies/${id}`, payload);
  return data;
};
