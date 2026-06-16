import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRecommendation,
  fetchRecommendation,
  fetchRecommendations,
  updateRecommendation,
} from '@/api/recommendations';
import { INTERN_STATS_QUERY_KEY, INTERNS_QUERY_KEY, internDetailKey } from '@/queries/interns';

export const RECOMMENDATIONS_QUERY_KEY = ['recommendations'];

export const recommendationDetailKey = (id) => ['recommendation', id];

const invalidateRecommendationContext = (queryClient, recommendation) => {
  queryClient.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY });

  if (recommendation?._id) {
    queryClient.invalidateQueries({ queryKey: recommendationDetailKey(recommendation._id) });
  }

  const userId = recommendation?.internProfile?.user?._id || recommendation?.internProfile?.user;
  if (userId) {
    queryClient.invalidateQueries({ queryKey: internDetailKey(userId) });
  }

  queryClient.invalidateQueries({ queryKey: INTERNS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: INTERN_STATS_QUERY_KEY });
};

export const useRecommendations = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, params],
    queryFn: () => fetchRecommendations(params),
    ...options,
  });

export const useRecommendation = (id, options = {}) =>
  useQuery({
    queryKey: recommendationDetailKey(id),
    queryFn: () => fetchRecommendation(id),
    enabled: Boolean(id),
    ...options,
  });

export const useCreateRecommendation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRecommendation,
    onSuccess: (recommendation) => {
      invalidateRecommendationContext(queryClient, recommendation);
    },
  });
};

export const useUpdateRecommendation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateRecommendation(id, payload),
    onSuccess: (recommendation) => {
      invalidateRecommendationContext(queryClient, recommendation);
    },
  });
};
