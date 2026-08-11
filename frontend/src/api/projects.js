import apiClient from '@/api/axios';

export const fetchProjects = async ({ includeAll = false, status } = {}) => {
  const params = {};
  if (includeAll) params.includeAll = 'true';
  if (status) params.status = status;
  const { data } = await apiClient.get('/projects', { params });
  return data;
};

export const fetchProject = async (id) => {
  const { data } = await apiClient.get(`/projects/${id}`);
  return data.data;
};

// Leadership-facing aggregates — the two new endpoints respond
// { success, message, data }, unlike the plain-array endpoints above.
export const fetchProjectsOverview = async () => {
  const { data } = await apiClient.get('/projects/overview');
  return data.data;
};

export const fetchProjectOverview = async (id) => {
  const { data } = await apiClient.get(`/projects/${id}/overview`);
  return data.data;
};

export const createProject = async (payload) => {
  const { data } = await apiClient.post('/projects', payload);
  return data;
};

export const updateProject = async (id, payload) => {
  const { data } = await apiClient.patch(`/projects/${id}`, payload);
  return data;
};

// Leadership-only: ask admins to staff interns onto a project. Notify-only —
// nothing is persisted beyond the notification admins receive.
export const requestInternsForProject = async (id, payload) => {
  const { data } = await apiClient.post(`/projects/${id}/request-interns`, payload);
  return data.data;
};
