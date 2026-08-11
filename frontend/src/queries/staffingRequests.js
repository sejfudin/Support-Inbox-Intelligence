import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeStaffingRequest,
  createStaffingRequest,
  fetchStaffingRequests,
  reopenStaffingRequest,
  updateStaffingRequest,
} from '@/api/staffingRequests';

export const STAFFING_REQUESTS_QUERY_KEY = ['staffing-requests'];

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

export const useReopenStaffingRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => reopenStaffingRequest(id),
    onSuccess: () => invalidateRequests(queryClient),
  });
};
