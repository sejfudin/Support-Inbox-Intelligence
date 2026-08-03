import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignSpecialization,
  fetchSpecializedCandidates,
  fetchUnspecializedCandidates,
} from '@/api/specializations';
import {
  INTERN_STATS_QUERY_KEY,
  INTERNS_QUERY_KEY,
  MY_INTERN_PROFILE_QUERY_KEY,
  internDetailKey,
} from '@/queries/interns';

export const SPECIALIZED_CANDIDATES_QUERY_KEY = ['specializations', 'specialized'];
export const UNSPECIALIZED_CANDIDATES_QUERY_KEY = ['specializations', 'unspecialized'];

const invalidateSpecializationContext = (queryClient, specialization) => {
  queryClient.invalidateQueries({ queryKey: SPECIALIZED_CANDIDATES_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: UNSPECIALIZED_CANDIDATES_QUERY_KEY });

  const userId = specialization?.user?._id || specialization?.user;
  if (userId) {
    queryClient.invalidateQueries({ queryKey: internDetailKey(userId) });
  }

  queryClient.invalidateQueries({ queryKey: MY_INTERN_PROFILE_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: INTERNS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: INTERN_STATS_QUERY_KEY });
};

export const useSpecializedCandidates = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...SPECIALIZED_CANDIDATES_QUERY_KEY, params],
    queryFn: () => fetchSpecializedCandidates(params),
    ...options,
  });

export const useUnspecializedCandidates = (options = {}) =>
  useQuery({
    queryKey: UNSPECIALIZED_CANDIDATES_QUERY_KEY,
    queryFn: fetchUnspecializedCandidates,
    ...options,
  });

export const useAssignSpecialization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignSpecialization,
    onSuccess: (specialization) => {
      invalidateSpecializationContext(queryClient, specialization);
    },
  });
};
