import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchMyAttendanceRequests,
  createAttendanceRequest,
  cancelAttendanceRequest,
  fetchAttendanceRequests,
  decideAttendanceRequest,
  revokeAttendanceRequest,
} from '@/api/attendanceRequests';
import { MY_ATTENDANCE_QUERY_KEY, ATTENDANCE_ROSTER_QUERY_KEY } from '@/queries/attendance';

export const MY_ATTENDANCE_REQUESTS_QUERY_KEY = ['attendance-requests', 'me'];
export const ATTENDANCE_REQUESTS_QUERY_KEY = ['attendance-requests', 'admin'];

// A decision writes attendance rows, so every mutation here has to invalidate
// attendance as well as itself — otherwise the calendar keeps showing the day as
// absent until the next full reload.
const INTERN_ATTENDANCE_KEY = ['attendance', 'intern'];

const onRequestError = (fallback) => (error) =>
  toast.error(error?.response?.data?.message || fallback);

export const useMyAttendanceRequests = (options = {}) =>
  useQuery({
    queryKey: MY_ATTENDANCE_REQUESTS_QUERY_KEY,
    queryFn: fetchMyAttendanceRequests,
    ...options,
  });

export const useCreateAttendanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAttendanceRequest,
    onSuccess: (attendanceRequests) => {
      queryClient.setQueryData(MY_ATTENDANCE_REQUESTS_QUERY_KEY, attendanceRequests);
      queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_REQUESTS_QUERY_KEY });
      toast.success('Request sent. Your admin will review it.');
    },
    onError: onRequestError('Could not send your request. Please try again.'),
  });
};

export const useCancelAttendanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelAttendanceRequest,
    onSuccess: (attendanceRequests) => {
      queryClient.setQueryData(MY_ATTENDANCE_REQUESTS_QUERY_KEY, attendanceRequests);
      queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_REQUESTS_QUERY_KEY });
      toast.success('Request withdrawn.');
    },
    onError: onRequestError('Could not withdraw the request. Please try again.'),
  });
};

export const useAttendanceRequests = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...ATTENDANCE_REQUESTS_QUERY_KEY, params],
    queryFn: () => fetchAttendanceRequests(params),
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
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_REQUESTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_ROSTER_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INTERN_ATTENDANCE_KEY });
      queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_QUERY_KEY });
      toast.success(success);
    },
    onError: onRequestError(failure),
  });
};

export const useDecideAttendanceRequest = () =>
  useAdminRequestMutation(decideAttendanceRequest, {
    success: 'Decision recorded.',
    failure: 'Could not record the decision. Please try again.',
  });

export const useRevokeAttendanceRequest = () =>
  useAdminRequestMutation(revokeAttendanceRequest, {
    success: 'Approval revoked.',
    failure: 'Could not revoke the approval. Please try again.',
  });
