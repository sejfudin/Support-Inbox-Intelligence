import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createInternComment,
  createInternEvaluation,
  deleteMyCv,
  fetchCommentViewers,
  fetchIntern,
  fetchInternComments,
  fetchInternEvaluations,
  fetchInternCvSummary,
  fetchInternReadiness,
  fetchInterns,
  generateInternCvSummary,
  fetchInternStats,
  fetchMyInternProfile,
  fetchMyInternReadiness,
  updateIntern,
  transferInternPrimaryMentor,
  updateInternDocumentationLinks,
  updateInternalCvLink,
  updateMyTechnologies,
  updateMyPosition,
  updateMySecondaryPosition,
  uploadMyCv,
  upsertInternReadiness,
} from '@/api/interns';

export const INTERNS_QUERY_KEY = ['interns'];
export const INTERN_STATS_QUERY_KEY = ['interns', 'stats'];
export const MY_INTERN_PROFILE_QUERY_KEY = ['intern-profile', 'me'];
export const MY_INTERN_READINESS_QUERY_KEY = ['intern-readiness', 'me'];

export const internDetailKey = (userId) => ['intern', userId];
export const internCommentsKey = (userId) => ['intern-comments', userId];
export const internEvaluationsKey = (userId) => ['intern-evaluations', userId];
export const internCvSummaryKey = (userId) => ['intern-cv-summary', userId];
export const internReadinessKey = (userId) => ['intern-readiness', userId];

export const useInterns = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...INTERNS_QUERY_KEY, params],
    queryFn: () => fetchInterns(params),
    ...options,
  });

export const useInternStats = (options = {}) =>
  useQuery({
    queryKey: INTERN_STATS_QUERY_KEY,
    queryFn: fetchInternStats,
    staleTime: 60 * 1000,
    ...options,
  });

export const useIntern = (userId, options = {}) =>
  useQuery({
    queryKey: internDetailKey(userId),
    queryFn: () => fetchIntern(userId),
    enabled: Boolean(userId),
    ...options,
  });

export const useMyInternProfile = (options = {}) =>
  useQuery({
    queryKey: MY_INTERN_PROFILE_QUERY_KEY,
    queryFn: fetchMyInternProfile,
    ...options,
  });

export const useMyInternReadiness = (options = {}) =>
  useQuery({
    queryKey: MY_INTERN_READINESS_QUERY_KEY,
    queryFn: fetchMyInternReadiness,
    ...options,
  });

export const useUpdateMyTechnologies = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyTechnologies,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_INTERN_PROFILE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MY_INTERN_READINESS_QUERY_KEY });
    },
  });
};

export const useUpdateMyPosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_INTERN_PROFILE_QUERY_KEY });
    },
  });
};

export const useUpdateMySecondaryPosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMySecondaryPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_INTERN_PROFILE_QUERY_KEY });
    },
  });
};

export const useUploadMyCv = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadMyCv,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_INTERN_PROFILE_QUERY_KEY });
    },
  });
};

export const useDeleteMyCv = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMyCv,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_INTERN_PROFILE_QUERY_KEY });
    },
  });
};

export const useUpdateIntern = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }) => updateIntern(userId, payload),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: internDetailKey(userId) });
      queryClient.invalidateQueries({ queryKey: INTERNS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INTERN_STATS_QUERY_KEY });
    },
  });
};

export const useTransferInternPrimaryMentor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, newAdminId }) => transferInternPrimaryMentor(userId, newAdminId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: internDetailKey(userId) });
      queryClient.invalidateQueries({ queryKey: INTERNS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INTERN_STATS_QUERY_KEY });
    },
  });
};

export const useUpdateInternDocumentationLinks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, links }) => updateInternDocumentationLinks(userId, links),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: internDetailKey(userId) });
      queryClient.invalidateQueries({ queryKey: MY_INTERN_PROFILE_QUERY_KEY });
    },
  });
};

export const useUpdateInternalCvLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, url }) => updateInternalCvLink(userId, url),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: internDetailKey(userId) });
    },
  });
};

export const useInternComments = (userId, options = {}) =>
  useQuery({
    queryKey: internCommentsKey(userId),
    queryFn: () => fetchInternComments(userId),
    enabled: Boolean(userId),
    ...options,
  });

export const useCommentViewers = (options = {}) =>
  useQuery({
    queryKey: ['comment-viewers'],
    queryFn: fetchCommentViewers,
    ...options,
  });

export const useCreateInternComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }) => createInternComment(userId, payload),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: internCommentsKey(userId) });
    },
  });
};

export const useInternEvaluations = (userId, options = {}) =>
  useQuery({
    queryKey: internEvaluationsKey(userId),
    queryFn: () => fetchInternEvaluations(userId),
    enabled: Boolean(userId),
    ...options,
  });

export const useCreateInternEvaluation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }) => createInternEvaluation(userId, payload),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: internEvaluationsKey(userId) });
    },
  });
};

export const useInternReadiness = (userId, options = {}) =>
  useQuery({
    queryKey: internReadinessKey(userId),
    queryFn: () => fetchInternReadiness(userId),
    enabled: Boolean(userId),
    ...options,
  });

export const useUpsertInternReadiness = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }) => upsertInternReadiness(userId, payload),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: internReadinessKey(userId) });
      queryClient.invalidateQueries({ queryKey: MY_INTERN_READINESS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INTERN_STATS_QUERY_KEY });
    },
  });
};

/**
 * The cached AI read of an intern's uploaded CV. Never generates — the GET is
 * free and the POST below is what costs a model call, so the panel can mount on
 * every profile view without spending anything.
 */
export const useInternCvSummary = (userId, options = {}) =>
  useQuery({
    queryKey: internCvSummaryKey(userId),
    queryFn: () => fetchInternCvSummary(userId),
    enabled: Boolean(userId),
    ...options,
  });

export const useGenerateInternCvSummary = (userId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateInternCvSummary(userId),
    // Written straight into the cache: the response IS the new summary, so
    // refetching it would be a second round trip for bytes already in hand.
    onSuccess: (summary) => queryClient.setQueryData(internCvSummaryKey(userId), summary),
    onError: (error) =>
      toast.error(
        error?.response?.data?.message || 'Could not summarise the CV. Please try again.'
      ),
  });
};
