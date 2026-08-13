import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchMyRemoteWork,
  createRemoteWorkRequest,
  cancelRemoteWorkRequest,
  fetchRemoteWorkRequests,
  decideRemoteWorkRequest,
  revokeRemoteWorkRequest,
} from '@/api/remoteWork';
import { MY_ATTENDANCE_QUERY_KEY, ATTENDANCE_ROSTER_QUERY_KEY } from '@/queries/attendance';

export const MY_REMOTE_WORK_QUERY_KEY = ['remote-work', 'me'];
export const REMOTE_WORK_QUERY_KEY = ['remote-work', 'admin'];

// A remote-work decision writes an attendance row, so every mutation here has to
// invalidate attendance as well as itself — otherwise the calendar keeps showing
// the day as absent until the next full reload.
const INTERN_ATTENDANCE_KEY = ['attendance', 'intern'];

const onRemoteWorkError = (fallback) => (error) =>
  toast.error(error?.response?.data?.message || fallback);

export const useMyRemoteWork = (options = {}) =>
  useQuery({
    queryKey: MY_REMOTE_WORK_QUERY_KEY,
    queryFn: fetchMyRemoteWork,
    ...options,
  });

export const useRequestRemoteWork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRemoteWorkRequest,
    onSuccess: (remoteWork) => {
      queryClient.setQueryData(MY_REMOTE_WORK_QUERY_KEY, remoteWork);
      queryClient.invalidateQueries({ queryKey: MY_REMOTE_WORK_QUERY_KEY });
      toast.success('Remote work requested. Your admin will review it.');
    },
    onError: onRemoteWorkError('Could not send your request. Please try again.'),
  });
};

export const useCancelRemoteWorkRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelRemoteWorkRequest,
    onSuccess: (remoteWork) => {
      queryClient.setQueryData(MY_REMOTE_WORK_QUERY_KEY, remoteWork);
      queryClient.invalidateQueries({ queryKey: MY_REMOTE_WORK_QUERY_KEY });
      toast.success('Request withdrawn.');
    },
    onError: onRemoteWorkError('Could not withdraw the request. Please try again.'),
  });
};

export const useRemoteWorkRequests = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...REMOTE_WORK_QUERY_KEY, params],
    queryFn: () => fetchRemoteWorkRequests(params),
    ...options,
  });

// Both admin actions land the same way: refresh the queue, and refresh every
// attendance surface, because an approval or a revocation adds or removes a day.
const useAdminRemoteWorkMutation = (mutationFn, { success, failure }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REMOTE_WORK_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_ROSTER_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INTERN_ATTENDANCE_KEY });
      queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_QUERY_KEY });
      toast.success(success);
    },
    onError: onRemoteWorkError(failure),
  });
};

export const useDecideRemoteWorkRequest = () =>
  useAdminRemoteWorkMutation(decideRemoteWorkRequest, {
    success: 'Decision recorded.',
    failure: 'Could not record the decision. Please try again.',
  });

export const useRevokeRemoteWorkRequest = () =>
  useAdminRemoteWorkMutation(revokeRemoteWorkRequest, {
    success: 'Approval revoked.',
    failure: 'Could not revoke the approval. Please try again.',
  });
