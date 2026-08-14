import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchAttendanceRequestSettings,
  updateAttendanceRequestSettings,
  resetAttendanceRequestSettings,
} from '@/api/attendanceRequestSettings';
import { MY_ATTENDANCE_REQUESTS_QUERY_KEY } from '@/queries/attendanceRequests';

export const ATTENDANCE_REQUEST_SETTINGS_QUERY_KEY = ['attendance-request-settings'];

export const useAttendanceRequestSettings = (options = {}) =>
  useQuery({
    queryKey: ATTENDANCE_REQUEST_SETTINGS_QUERY_KEY,
    queryFn: fetchAttendanceRequestSettings,
    ...options,
  });

// Changing a limit changes what the intern's request form offers, so the cached
// request list goes with it. Harmless for the admin doing the saving — they have
// no such list — and correct for anyone who is both.
const useSettingsMutation = (mutationFn, { success, failure }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (settings) => {
      queryClient.setQueryData(ATTENDANCE_REQUEST_SETTINGS_QUERY_KEY, settings);
      queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_REQUESTS_QUERY_KEY });
      toast.success(success);
    },
    onError: (error) => toast.error(error?.response?.data?.message || failure),
  });
};

export const useUpdateAttendanceRequestSettings = () =>
  useSettingsMutation(updateAttendanceRequestSettings, {
    success: 'Request limits saved.',
    failure: 'Could not save the limits. Please try again.',
  });

export const useResetAttendanceRequestSettings = () =>
  useSettingsMutation(resetAttendanceRequestSettings, {
    success: 'Request limits reset to defaults.',
    failure: 'Could not reset the limits. Please try again.',
  });
