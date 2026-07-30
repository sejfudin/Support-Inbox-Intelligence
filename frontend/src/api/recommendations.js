import apiClient from '@/api/axios';

export const fetchRecommendations = async (params = {}) => {
  const { data } = await apiClient.get('/recommendations', { params });
  return data;
};

export const fetchRecommendation = async (id) => {
  const { data } = await apiClient.get(`/recommendations/${id}`);
  return data.recommendation;
};

export const createRecommendation = async (payload) => {
  const { data } = await apiClient.post('/recommendations', payload);
  return data.recommendation;
};

export const updateRecommendation = async (id, payload) => {
  const { data } = await apiClient.patch(`/recommendations/${id}`, payload);
  return data.recommendation;
};

export const deleteRecommendation = async (id) => {
  const { data } = await apiClient.delete(`/recommendations/${id}`);
  return data.recommendation;
};
