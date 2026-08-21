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

/**
 * Surface a server rejection instead of failing silently, and re-sync the cache
 * with the server's real state.
 *
 * A 422 from this route is not a failure — it is the day answering back. The
 * server refuses a check-in with 422 for every reason the day is not the intern's
 * to claim (approved vacation, sick leave, a religious holiday, a remote day, a
 * cohort holiday, the weekend, before their start date, after they were placed,
 * outside the 07:00–11:00 window) and attaches a sentence saying which. That reads
 * as guidance, so it gets a warning toast with the reason as its body rather than
 * a red error — nothing broke, and the intern has nothing to retry.
 *
 * Anything else (a 500, a dropped connection) genuinely did fail, and still says so.
 */
const onAttendanceError =
  (queryClient, { title, fallback }) =>
  (error) => {
    const message = error?.response?.data?.message;
    if (error?.response?.status === 422 && message) {
      toast.warning(title, { description: message });
    } else {
      toast.error(message || fallback);
    }
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
    onError: onAttendanceError(queryClient, {
      title: "You can't check in today",
      fallback: 'Could not check in. Please try again.',
    }),
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
    onError: onAttendanceError(queryClient, {
      title: "Your check-in can't be cancelled",
      fallback: 'Could not cancel your check-in. Please try again.',
    }),
  });
};

export const useAttendanceRoster = (params = {}, options = {}) =>
  useQuery({
    queryKey: [...ATTENDANCE_ROSTER_QUERY_KEY, params],
    queryFn: () => fetchAttendanceRoster(params),
    placeholderData: keepPreviousData,
    ...options,
  });

export const useInternAttendance = (internProfileId, month, options = {}) =>
  useQuery({
    queryKey: [...INTERN_ATTENDANCE_QUERY_KEY, internProfileId, month],
    queryFn: () => fetchInternAttendance(internProfileId, month),
    enabled: Boolean(internProfileId),
    ...options,
  });
