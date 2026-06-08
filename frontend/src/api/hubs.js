import apiClient from '@/api/axios';

export const fetchHubs = async ({ includeInactive = false } = {}) => {
  const params = includeInactive ? { includeInactive: 'true' } : undefined;
  const { data } = await apiClient.get('/hubs', { params });
  return data;
};

export const createHub = async (payload) => {
  const { data } = await apiClient.post('/hubs', payload);
  return data;
};

export const updateHub = async (id, payload) => {
  const { data } = await apiClient.patch(`/hubs/${id}`, payload);
  return data;
};
