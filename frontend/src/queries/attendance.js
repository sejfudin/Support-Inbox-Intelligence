import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchMyAttendance,
  checkInToday,
  cancelTodayCheckIn,
  fetchAttendanceRoster,
  fetchInternAttendance,
} from '@/api/attendance';

export const MY_ATTENDANCE_QUERY_KEY = ['attendance', 'me'];
export const ATTENDANCE_ROSTER_QUERY_KEY = ['attendance', 'roster'];
export const INTERN_ATTENDANCE_QUERY_KEY = ['attendance', 'intern'];

// Surface a server rejection (e.g. window closed, day locked) instead of failing
// silently, and re-sync the cache with the server's real state.
const onAttendanceError = (queryClient, fallback) => (error) => {
  toast.error(error?.response?.data?.message || fallback);
  queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_QUERY_KEY });
};

export const useMyAttendance = (options = {}) =>
  useQuery({
    queryKey: MY_ATTENDANCE_QUERY_KEY,
    queryFn: fetchMyAttendance,
    ...options,
  });

export const useCheckInToday = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkInToday,
    onSuccess: (attendance) => {
      // Seed the cache with the returned summary and revalidate.
      queryClient.setQueryData(MY_ATTENDANCE_QUERY_KEY, attendance);
      queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_ROSTER_QUERY_KEY });
    },
    onError: onAttendanceError(queryClient, 'Could not check in. Please try again.'),
  });
};

export const useCancelTodayCheckIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelTodayCheckIn,
    onSuccess: (attendance) => {
      queryClient.setQueryData(MY_ATTENDANCE_QUERY_KEY, attendance);
      queryClient.invalidateQueries({ queryKey: MY_ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_ROSTER_QUERY_KEY });
    },
    onError: onAttendanceError(queryClient, 'Could not cancel your check-in. Please try again.'),
  });
};

export const useAttendanceRoster = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...ATTENDANCE_ROSTER_QUERY_KEY, params],
    queryFn: () => fetchAttendanceRoster(params),
    placeholderData: keepPreviousData,
    ...options,
  });

export const useInternAttendance = (internProfileId, options = {}) =>
  useQuery({
    queryKey: [...INTERN_ATTENDANCE_QUERY_KEY, internProfileId],
    queryFn: () => fetchInternAttendance(internProfileId),
    enabled: Boolean(internProfileId),
    ...options,
  });
