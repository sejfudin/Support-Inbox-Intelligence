import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  runDailyReminderCheck,
} from '@/api/notifications';
import { invalidateUserScope } from '@/lib/invalidationScopes';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];

export function useNotifications({ userId, ...options } = {}) {
  const queryKey = userId ? [...NOTIFICATIONS_QUERY_KEY, String(userId)] : NOTIFICATIONS_QUERY_KEY;

  return useQuery({
    queryKey,
    queryFn: () => getNotifications({ limit: 30 }),
    staleTime: 0,
    refetchOnMount: 'always',
    ...options,
  });
}

/**
 * Fires the on-arrival daily reminder check. No cache to touch — the reminder
 * itself arrives over the socket, which invalidates the bell the usual way.
 */
export function useRunDailyReminderCheck() {
  return useMutation({
    mutationFn: () => runDailyReminderCheck(),
    // A missed nudge is not worth a toast or a retry storm; the scheduler and
    // the next visibility change both get another chance.
    retry: false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => {
      invalidateUserScope(queryClient);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      invalidateUserScope(queryClient);
    },
  });
}
