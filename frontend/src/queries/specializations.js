import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignSpecialization,
  changeSpecializationMentor,
  clearSpecialization,
  fetchSpecializations,
  fetchUnspecializedCandidates,
  reassignSpecialization,
} from '@/api/specializations';
import {
  INTERN_STATS_QUERY_KEY,
  INTERNS_QUERY_KEY,
  MY_INTERN_PROFILE_QUERY_KEY,
  internDetailKey,
} from '@/queries/interns';

export const SPECIALIZATIONS_QUERY_KEY = ['specializations', 'list'];
export const UNSPECIALIZED_CANDIDATES_QUERY_KEY = ['specializations', 'unspecialized'];

const invalidateSpecializationContext = (queryClient, specialization) => {
  queryClient.invalidateQueries({ queryKey: SPECIALIZATIONS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: UNSPECIALIZED_CANDIDATES_QUERY_KEY });

  const userId = specialization?.user?._id || specialization?.user;
  if (userId) {
    queryClient.invalidateQueries({ queryKey: internDetailKey(userId) });
  }

  queryClient.invalidateQueries({ queryKey: MY_INTERN_PROFILE_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: INTERNS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: INTERN_STATS_QUERY_KEY });
};

export const useSpecializations = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...SPECIALIZATIONS_QUERY_KEY, params],
    queryFn: () => fetchSpecializations(params),
    placeholderData: keepPreviousData,
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

export const useReassignSpecialization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reassignSpecialization,
    onSuccess: (specialization) => {
      invalidateSpecializationContext(queryClient, specialization);
    },
  });
};

export const useChangeSpecializationMentor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ internUserId, mentorId }) => changeSpecializationMentor(internUserId, mentorId),
    onSuccess: (specialization) => {
      invalidateSpecializationContext(queryClient, specialization);
    },
  });
};

export const useClearSpecialization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearSpecialization,
    onSuccess: (specialization) => {
      invalidateSpecializationContext(queryClient, specialization);
    },
  });
};
