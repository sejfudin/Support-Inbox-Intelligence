import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/api/notifications";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"];

export function useNotifications({ userId, ...options } = {}) {
  const queryKey = userId
    ? [...NOTIFICATIONS_QUERY_KEY, String(userId)]
    : NOTIFICATIONS_QUERY_KEY;

  return useQuery({
    queryKey,
    queryFn: () => getNotifications({ limit: 30 }),
    staleTime: 0,
    refetchOnMount: "always",
    ...options,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}
