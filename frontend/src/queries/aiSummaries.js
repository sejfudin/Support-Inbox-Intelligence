import { useMutation } from '@tanstack/react-query';
import { generateUserAiSummary } from '@/api/aiSummaries';

export const useGenerateUserAiSummary = () => {
  return useMutation({
    mutationFn: generateUserAiSummary,
  });
};
