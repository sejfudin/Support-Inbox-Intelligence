import { useMutation, useQuery } from '@tanstack/react-query';
import { getLatestUserAiSummary, generateUserAiSummary } from '@/api/aiSummaries';

export const useGetLatestUserAiSummary = ({ userId, workspaceId, enabled = true }) => {
  return useQuery({
    queryKey: ['aiSummary', userId, workspaceId],
    queryFn: () => getLatestUserAiSummary({ userId, workspaceId }),
    enabled: enabled && !!userId && !!workspaceId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useGenerateUserAiSummary = () => {
  return useMutation({
    mutationFn: generateUserAiSummary,
  });
};
