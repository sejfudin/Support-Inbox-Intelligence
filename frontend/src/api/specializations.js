import apiClient from '@/api/axios';

export const fetchSpecializations = async (params = {}) => {
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

export const reassignSpecialization = async (internUserId) => {
  const { data } = await apiClient.patch(`/specializations/${internUserId}/reassign`);
  return data.specialization;
};

export const changeSpecializationMentor = async (internUserId, mentorId) => {
  const { data } = await apiClient.patch(`/specializations/${internUserId}/mentor`, {
    mentorId,
  });
  return data.specialization;
};

export const clearSpecialization = async (internUserId) => {
  const { data } = await apiClient.delete(`/specializations/${internUserId}`);
  return data.specialization;
};
