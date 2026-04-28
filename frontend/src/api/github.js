import apiClient from "./axios";

export const initiateGitHubInstallation = async (workspaceId) => {
  const response = await apiClient.get("/github/install", {
    params: { workspaceId },
  });
  return response.data;
};

export const getIntegration = async (workspaceId) => {
  const response = await apiClient.get(`/github/workspaces/${workspaceId}/integration`);
  return response.data;
};

export const updateIntegration = async (workspaceId, data) => {
  const response = await apiClient.patch(`/github/workspaces/${workspaceId}/integration`, data);
  return response.data;
};

export const disconnectIntegration = async (workspaceId) => {
  const response = await apiClient.delete(`/github/workspaces/${workspaceId}/integration`);
  return response.data;
};

export const getRepositories = async (workspaceId) => {
  const response = await apiClient.get(`/github/workspaces/${workspaceId}/repositories`);
  return response.data;
};

export const refreshPR = async (ticketId, workspaceId) => {
  const response = await apiClient.post(`/github/tickets/${ticketId}/refresh-pr`, {}, {
    params: { workspaceId },
  });
  return response.data;
};

export const unlinkPR = async (ticketId) => {
  const response = await apiClient.delete(`/github/tickets/${ticketId}/unlink-pr`);
  return response.data;
};
