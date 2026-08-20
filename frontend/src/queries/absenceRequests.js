import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchMyAbsenceRequests,
  createAbsenceRequest,
  cancelAbsenceRequest,
  fetchAbsenceRequests,
  decideAbsenceRequest,
  revokeAbsenceRequest,
} from '@/api/absenceRequests';
import { MY_ATTENDANCE_QUERY_KEY, ATTENDANCE_ROSTER_QUERY_KEY } from '@/queries/attendance';

export const MY_ABSENCE_REQUESTS_QUERY_KEY = ['absence-requests', 'me'];
export const ABSENCE_REQUESTS_QUERY_KEY = ['absence-requests', 'admin'];

// A decision writes attendance rows, so every mutation here has to invalidate
// attendance as well as itself — otherwise the calendar keeps showing the day as
// absent until the next full reload.
const INTERN_ATTENDANCE_KEY = ['attendance', 'intern'];

const onRequestError = (fallback) => (error) =>
  toast.error(error?.response?.data?.message || fallback);

export const useMyAbsenceRequests = (options = {}) =>
  useQuery({
    queryKey: MY_ABSENCE_REQUESTS_QUERY_KEY,
    queryFn: fetchMyAbsenceRequests,
    ...options,
  });

export const useCreateAbsenceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAbsenceRequest,
    onSuccess: (absenceRequests) => {
      queryClient.setQueryData(MY_ABSENCE_REQUESTS_QUERY_KEY, absenceRequests);
      queryClient.invalidateQueries({ queryKey: MY_ABSENCE_REQUESTS_QUERY_KEY });
      toast.success('Request sent. Your admin will review it.');
    },
    onError: onRequestError('Could not send your request. Please try again.'),
  });
};

export const useCancelAbsenceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelAbsenceRequest,
    onSuccess: (absenceRequests) => {
      queryClient.setQueryData(MY_ABSENCE_REQUESTS_QUERY_KEY, absenceRequests);
      queryClient.invalidateQueries({ queryKey: MY_ABSENCE_REQUESTS_QUERY_KEY });
      toast.success('Request withdrawn.');
    },
    onError: onRequestError('Could not withdraw the request. Please try again.'),
  });
};

export const useAbsenceRequests = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...ABSENCE_REQUESTS_QUERY_KEY, params],
    queryFn: () => fetchAbsenceRequests(params),
    ...options,
  });

// Both admin actions land the same way: refresh the queue, and refresh every
// attendance surface, because an approval or a revocation adds or removes days —
// and for the leave types it also moves the denominator, so the rate on screen is
// stale until this runs.
const useAdminRequestMutation = (mutationFn, { success, failure }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ABSENCE_REQUESTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_ROSTER_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INTERN_ATTENDANCE_KEY });
      queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_QUERY_KEY });
      toast.success(success);
    },
    onError: onRequestError(failure),
  });
};

export const useDecideAbsenceRequest = () =>
  useAdminRequestMutation(decideAbsenceRequest, {
    success: 'Decision recorded.',
    failure: 'Could not record the decision. Please try again.',
  });

export const useRevokeAbsenceRequest = () =>
  useAdminRequestMutation(revokeAbsenceRequest, {
    success: 'Approval revoked.',
    failure: 'Could not revoke the approval. Please try again.',
  });
