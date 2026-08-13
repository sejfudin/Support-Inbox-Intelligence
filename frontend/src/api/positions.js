import apiClient from '@/api/axios';

export const fetchPositions = async ({ includeInactive = false } = {}) => {
  const params = includeInactive ? { includeInactive: 'true' } : undefined;
  const { data } = await apiClient.get('/positions', { params });
  return data;
};

export const createPosition = async (payload) => {
  const { data } = await apiClient.post('/positions', payload);
  return data;
};

export const updatePosition = async (id, payload) => {
  const { data } = await apiClient.patch(`/positions/${id}`, payload);
  return data;
};
