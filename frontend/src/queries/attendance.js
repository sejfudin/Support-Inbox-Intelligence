import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMyAttendance,
  checkInToday,
  cancelTodayCheckIn,
  fetchAttendanceRoster,
} from '@/api/attendance';

export const MY_ATTENDANCE_QUERY_KEY = ['attendance', 'me'];
export const ATTENDANCE_ROSTER_QUERY_KEY = ['attendance', 'roster'];

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
  });
};

export const useAttendanceRoster = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...ATTENDANCE_ROSTER_QUERY_KEY, params],
    queryFn: () => fetchAttendanceRoster(params),
    ...options,
  });
