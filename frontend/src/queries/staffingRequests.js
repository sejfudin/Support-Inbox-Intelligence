import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeStaffingRequest,
  createStaffingRequest,
  fetchStaffingRequest,
  fetchStaffingRequests,
  reopenStaffingRequest,
  setStaffingRequestNote,
  updateStaffingRequest,
} from '@/api/staffingRequests';

export const STAFFING_REQUESTS_QUERY_KEY = ['staffing-requests'];
export const staffingRequestDetailKey = (id) => ['staffing-request', id];

// Every write invalidates both the list and the mutated request's own detail
// query — the page shows a row and its opened detail at the same time, so
// refreshing only the list leaves the pane it was launched from stale.
const invalidateRequest = (queryClient, id) => {
  queryClient.invalidateQueries({ queryKey: STAFFING_REQUESTS_QUERY_KEY });
  if (id) queryClient.invalidateQueries({ queryKey: staffingRequestDetailKey(id) });
};

export const useStaffingRequests = ({ status, mine } = {}) =>
  useQuery({
    queryKey: [...STAFFING_REQUESTS_QUERY_KEY, status || null, mine ? 'mine' : 'all'],
    queryFn: () => fetchStaffingRequests({ status, mine }),
    staleTime: 30 * 1000,
  });

export const useStaffingRequest = (id, options = {}) =>
  useQuery({
    queryKey: staffingRequestDetailKey(id),
    queryFn: () => fetchStaffingRequest(id),
    enabled: Boolean(id),
    ...options,
  });

export const useCreateStaffingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStaffingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFFING_REQUESTS_QUERY_KEY });
    },
  });
};

export const useUpdateStaffingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateStaffingRequest(id, data),
    onSuccess: (_result, { id }) => invalidateRequest(queryClient, id),
  });
};

// `data` is `{ reason, note? }` — see closeStaffingRequest in api/.
export const useCloseStaffingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => closeStaffingRequest(id, data),
    onSuccess: (_result, { id }) => invalidateRequest(queryClient, id),
  });
};

export const useReopenStaffingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => reopenStaffingRequest(id),
    onSuccess: (_result, { id }) => invalidateRequest(queryClient, id),
  });
};

export const useSetStaffingRequestNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => setStaffingRequestNote(id, data),
    onSuccess: (_result, { id }) => invalidateRequest(queryClient, id),
  });
};
