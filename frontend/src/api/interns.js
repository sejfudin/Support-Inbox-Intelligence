import apiClient from '@/api/axios';

export const fetchInterns = async (params = {}) => {
  const { data } = await apiClient.get('/interns', { params });
  return data;
};

export const fetchInternStats = async () => {
  const { data } = await apiClient.get('/interns/stats');
  return data.stats;
};

export const fetchIntern = async (userId) => {
  const { data } = await apiClient.get(`/interns/${userId}`);
  return data.intern;
};

export const fetchMyInternProfile = async () => {
  const { data } = await apiClient.get('/interns/me');
  return data.intern;
};

export const updateMyTechnologies = async (technologyIds) => {
  const { data } = await apiClient.patch('/interns/me/technologies', { technologyIds });
  return data.intern;
};

export const updateMyPosition = async (positionId) => {
  const { data } = await apiClient.patch('/interns/me/position', { positionId });
  return data.intern;
};

export const updateMySecondaryPosition = async (positionId) => {
  const { data } = await apiClient.patch('/interns/me/secondary-position', { positionId });
  return data.intern;
};

export const uploadMyCv = async (file) => {
  const formData = new FormData();
  formData.append('cv', file);
  const { data } = await apiClient.post('/interns/me/cv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteMyCv = async () => {
  const { data } = await apiClient.delete('/interns/me/cv');
  return data;
};

export const updateIntern = async (userId, payload) => {
  const { data } = await apiClient.patch(`/interns/${userId}`, payload);
  return data.intern;
};

export const updateInternDocumentationLinks = async (userId, links) => {
  const { data } = await apiClient.put(`/interns/${userId}/documentation-links`, { links });
  return data.intern;
};

export const updateInternalCvLink = async (userId, url) => {
  const { data } = await apiClient.put(`/interns/${userId}/internal-cv`, { url });
  return data.intern;
};

export const fetchInternComments = async (userId) => {
  const { data } = await apiClient.get(`/interns/${userId}/comments`);
  return data.comments;
};

export const createInternComment = async (userId, payload) => {
  const { data } = await apiClient.post(`/interns/${userId}/comments`, payload);
  return data.comment;
};

export const fetchCommentViewers = async () => {
  const { data } = await apiClient.get('/interns/comment-viewers');
  return data.users;
};

export const fetchInternEvaluations = async (userId) => {
  const { data } = await apiClient.get(`/interns/${userId}/evaluations`);
  return data.evaluations;
};

export const createInternEvaluation = async (userId, payload) => {
  const { data } = await apiClient.post(`/interns/${userId}/evaluations`, payload);
  return data.evaluation;
};

export const fetchMyInternReadiness = async () => {
  const { data } = await apiClient.get('/interns/me/readiness');
  return data.flags;
};

export const fetchInternReadiness = async (userId) => {
  const { data } = await apiClient.get(`/interns/${userId}/readiness`);
  return data.flags;
};

export const upsertInternReadiness = async (userId, payload) => {
  const { data } = await apiClient.put(`/interns/${userId}/readiness`, payload);
  return data.flag;
};
