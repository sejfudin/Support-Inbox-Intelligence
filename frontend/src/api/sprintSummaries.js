import apiClient from './axios';

// The workspace rides in the query string on the GET and in the body on the
// POST — the same split `api/sprints.js` uses, and the controller resolves it
// from either.
export const getSprintSummary = async ({ sprintId, workspaceId } = {}) => {
  const response = await apiClient.get(`/sprints/${sprintId}/summary`, {
    params: { workspace: workspaceId },
  });
  return response.data;
};

export const generateSprintSummary = async ({ sprintId, workspaceId } = {}) => {
  const response = await apiClient.post(`/sprints/${sprintId}/summary`, {
    workspace: workspaceId,
  });
  return response.data;
};
