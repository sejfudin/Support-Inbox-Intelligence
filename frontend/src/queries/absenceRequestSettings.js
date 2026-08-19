import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchAbsenceRequestSettings,
  updateAbsenceRequestSettings,
  resetAbsenceRequestSettings,
} from '@/api/absenceRequestSettings';
import { MY_ABSENCE_REQUESTS_QUERY_KEY } from '@/queries/absenceRequests';

export const ABSENCE_REQUEST_SETTINGS_QUERY_KEY = ['absence-request-settings'];

export const useAbsenceRequestSettings = (options = {}) =>
  useQuery({
    queryKey: ABSENCE_REQUEST_SETTINGS_QUERY_KEY,
    queryFn: fetchAbsenceRequestSettings,
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
      queryClient.setQueryData(ABSENCE_REQUEST_SETTINGS_QUERY_KEY, settings);
      queryClient.invalidateQueries({ queryKey: MY_ABSENCE_REQUESTS_QUERY_KEY });
      toast.success(success);
    },
    onError: (error) => toast.error(error?.response?.data?.message || failure),
  });
};

export const useUpdateAbsenceRequestSettings = () =>
  useSettingsMutation(updateAbsenceRequestSettings, {
    success: 'Request limits saved.',
    failure: 'Could not save the limits. Please try again.',
  });

export const useResetAbsenceRequestSettings = () =>
  useSettingsMutation(resetAbsenceRequestSettings, {
    success: 'Request limits reset to defaults.',
    failure: 'Could not reset the limits. Please try again.',
  });
