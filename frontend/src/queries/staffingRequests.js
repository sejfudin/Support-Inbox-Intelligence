import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeStaffingRequest,
  createStaffingRequest,
  fetchStaffingRequestHistory,
  fetchStaffingRequestNews,
  fetchStaffingRequests,
  fetchPutForwardCandidates,
  markStaffingRequestsSeen,
  putInternsForward,
  reopenStaffingRequest,
  resolveStaffingRequestProject,
  resolveStaffingRequestProjectByCreating,
  updateStaffingRequest,
} from '@/api/staffingRequests';
import { PROJECTS_QUERY_KEY } from '@/queries/projects';
import { RECOMMENDATIONS_QUERY_KEY } from '@/queries/recommendations';
import { INTERNS_QUERY_KEY } from '@/queries/interns';

export const STAFFING_REQUESTS_QUERY_KEY = ['staffing-requests'];
export const STAFFING_REQUEST_NEWS_QUERY_KEY = ['staffing-requests-news'];
export const STAFFING_REQUEST_CANDIDATES_QUERY_KEY = ['staffing-request-candidates'];

// Every write invalidates the list, and the list is the only reader: the
// Requests screen holds its opened request as a row out of that same array,
// so there is no separate detail query to keep in step. `GET /:id` exists on
// the server and has no frontend caller yet — when the admin side needs one,
// it adds the hook and a detail key alongside this one.
const invalidateRequests = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: STAFFING_REQUESTS_QUERY_KEY });
};

export const useStaffingRequests = ({ status, mine, projectId } = {}, options = {}) =>
  useQuery({
    queryKey: [
      ...STAFFING_REQUESTS_QUERY_KEY,
      status || null,
      mine ? 'mine' : 'all',
      projectId || null,
    ],
    queryFn: () => fetchStaffingRequests({ status, mine, projectId }),
    staleTime: 30 * 1000,
    ...options,
  });

export const useCreateStaffingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStaffingRequest,
    onSuccess: () => invalidateRequests(queryClient),
  });
};

export const useUpdateStaffingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateStaffingRequest(id, data),
    onSuccess: () => invalidateRequests(queryClient),
  });
};

// `data` is `{ reason, note? }` — see closeStaffingRequest in api/.
export const useCloseStaffingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => closeStaffingRequest(id, data),
    onSuccess: () => invalidateRequests(queryClient),
  });
};

// Resolving a draft project may also create a project, so both caches
// invalidate — the requests list picks up the new `project` reference, and
// the projects list/pickers pick up the row that may not have existed a
// moment ago.
export const useResolveStaffingRequestProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId }) => resolveStaffingRequestProject(id, projectId),
    onSuccess: () => {
      invalidateRequests(queryClient);
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
  });
};

export const useResolveStaffingRequestProjectByCreating = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, project }) => resolveStaffingRequestProjectByCreating(id, project),
    onSuccess: () => {
      invalidateRequests(queryClient);
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
  });
};

// Fetched only while the picker is open, and never cached across positions —
// the flags say where each intern is committed right now, and a stale one would
// hide a double-booking the admin is about to create.
export const usePutForwardCandidates = ({ requestId, positionId }, options = {}) =>
  useQuery({
    queryKey: [...STAFFING_REQUEST_CANDIDATES_QUERY_KEY, requestId, positionId],
    queryFn: () => fetchPutForwardCandidates(requestId, positionId),
    enabled: Boolean(requestId && positionId),
    staleTime: 0,
    ...options,
  });

// Putting interns forward creates recommendations, so both sides of that fact
// are invalidated: the requests list (its progress counts and the interns shown
// under each requested position are read off those recommendations) and the
// recommendation/intern caches that now have a new row.
export const usePutInternsForward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, positionId, internProfileIds }) =>
      putInternsForward(id, positionId, internProfileIds),
    onSuccess: () => {
      invalidateRequests(queryClient);
      queryClient.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INTERNS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STAFFING_REQUEST_CANDIDATES_QUERY_KEY });
    },
  });
};

export const useReopenStaffingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => reopenStaffingRequest(id),
    onSuccess: () => invalidateRequests(queryClient),
  });
};

// Drives the Requests nav badge and per-row "new" markers on both shells.
// Live via the `staffing-news:all` socket scope (lib/invalidationScopes.js),
// so no polling interval is needed here.
export const useStaffingRequestNews = (options = {}) =>
  useQuery({
    queryKey: STAFFING_REQUEST_NEWS_QUERY_KEY,
    queryFn: fetchStaffingRequestNews,
    staleTime: 30 * 1000,
    ...options,
  });

export const useMarkStaffingRequestsSeen = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markStaffingRequestsSeen,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFFING_REQUEST_NEWS_QUERY_KEY });
    },
  });
};

export const useStaffingRequestHistory = (requestId, options = {}) =>
  useQuery({
    queryKey: ['staffing-request-history', requestId],
    queryFn: () => fetchStaffingRequestHistory(requestId),
    enabled: Boolean(requestId),
    ...options,
  });
