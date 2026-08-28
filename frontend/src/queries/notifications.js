import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  runDailyReminderCheck,
} from '@/api/notifications';
import { invalidateUserScope } from '@/lib/invalidationScopes';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];

// `type` narrows the feed to one notification type — the mentor dashboard's
// "notes for me" card passes `mentor_note_from_staff` so it never has to
// client-filter the caller's normal mixed feed (ticket + programme events)
// down to the handful of staff notes buried in it. Omitted, this is the
// ordinary bell feed, unchanged.
export function useNotifications({ userId, limit = 30, type, ...options } = {}) {
  const queryKey = [
    ...NOTIFICATIONS_QUERY_KEY,
    ...(userId ? [String(userId)] : []),
    { limit, type },
  ];

  return useQuery({
    queryKey,
    queryFn: () => getNotifications({ limit, type }),
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
