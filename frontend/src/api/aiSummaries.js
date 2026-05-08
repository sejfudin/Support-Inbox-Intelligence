import apiClient from './axios';

export const generateUserAiSummary = async ({ userId, workspaceId, limit = 20 }) => {
  const response = await apiClient.post(`/ai-summaries/user/${userId}/generate`, {
    workspaceId,
    limit,
  });

  return response.data;
};
