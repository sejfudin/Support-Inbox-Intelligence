import apiClient from '@/api/axios';

export const fetchPositions = async () => {
  const { data } = await apiClient.get('/positions');
  return data;
};
