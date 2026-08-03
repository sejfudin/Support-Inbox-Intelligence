import apiClient from '@/api/axios';

export const fetchSpecializedCandidates = async (params = {}) => {
  const { data } = await apiClient.get('/specializations', { params });
  return data;
};

export const fetchUnspecializedCandidates = async () => {
  const { data } = await apiClient.get('/specializations/candidates');
  return data.candidates;
};

export const assignSpecialization = async (payload) => {
  const { data } = await apiClient.post('/specializations', payload);
  return data.specialization;
};
