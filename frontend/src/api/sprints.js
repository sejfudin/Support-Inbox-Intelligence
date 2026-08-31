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

// The previous sprint and its unfinished tickets, for the create modal's
// leftovers tab. `data.sprint` is null when the workspace has no previous
// sprint, and the tab is then not offered at all.
export const getSprintLeftovers = async ({ workspaceId } = {}) => {
  const response = await apiClient.get('/sprints/leftovers', {
    params: { workspace: workspaceId },
  });
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

export const updateSprint = async ({ id, workspaceId, name, start, end, goal }) => {
  const response = await apiClient.patch(`/sprints/${id}`, {
    workspace: workspaceId,
    name,
    start,
    end,
    goal,
  });
  return response.data;
};

// The workspace rides in the query string: a DELETE carries no body, and the
// controller resolves the caller's workspace from `?workspace=` or the account.
export const deleteSprint = async ({ id, workspaceId }) => {
  const response = await apiClient.delete(`/sprints/${id}`, {
    params: { workspace: workspaceId },
  });
  return response.data;
};
