import apiClient from './axios';

export const getSprints = async ({ workspaceId } = {}) => {
  const response = await apiClient.get('/sprints', { params: { workspace: workspaceId } });
  return response.data;
};

// The sprint a Sprints screen should show: the active one, else the next
// upcoming one, else null.
export const getCurrentSprint = async ({ workspaceId } = {}) => {
  const response = await apiClient.get('/sprints/current', { params: { workspace: workspaceId } });
  return response.data;
};

export const getSprint = async (id) => {
  const response = await apiClient.get(`/sprints/${id}`);
  return response.data;
};

export const createSprint = async ({ workspaceId, name, start, end, goal }) => {
  const response = await apiClient.post('/sprints', {
    workspace: workspaceId,
    name,
    start,
    end,
    goal,
  });
  return response.data;
};
