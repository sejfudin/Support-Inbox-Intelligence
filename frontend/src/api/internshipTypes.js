import apiClient from '@/api/axios';

export const fetchInternshipTypes = async ({ includeInactive = false } = {}) => {
  const params = includeInactive ? { includeInactive: 'true' } : undefined;
  const { data } = await apiClient.get('/internship-types', { params });
  return data;
};

export const createInternshipType = async (payload) => {
  const { data } = await apiClient.post('/internship-types', payload);
  return data;
};

export const updateInternshipType = async (id, payload) => {
  const { data } = await apiClient.patch(`/internship-types/${id}`, payload);
  return data;
};
