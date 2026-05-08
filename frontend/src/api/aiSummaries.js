import apiClient from './axios';

export const getLatestUserAiSummary = async ({ userId, workspaceId }) => {
  const response = await apiClient.get(`/ai-summaries/user/${userId}`, {
    params: { workspaceId },
  });

  return response.data;
};

export const generateUserAiSummary = async ({ userId, workspaceId, limit = 20 }) => {
  const response = await apiClient.post(`/ai-summaries/user/${userId}/generate`, {
    workspaceId,
    limit,
  });

  return response.data;
};
