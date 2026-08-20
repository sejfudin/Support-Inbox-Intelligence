import apiClient from './axios';
import { getActiveSocketId } from '@/lib/socketSession';

const buildSocketAwareConfig = () => {
  const socketId = getActiveSocketId();
  if (!socketId) {
    return undefined;
  }

  return {
    headers: {
      'x-socket-id': socketId,
    },
  };
};

export const getNotifications = async (params = {}) => {
  const response = await apiClient.get('/notifications', { params });
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await apiClient.patch(
    `/notifications/${id}/read`,
    undefined,
    buildSocketAwareConfig()
  );
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await apiClient.patch(
    '/notifications/read-all',
    undefined,
    buildSocketAwareConfig()
  );
  return response.data;
};

/**
 * POST /api/notifications/daily-reminder-check
 *
 * Asks the server whether this intern still owes today's check-in or standup
 * note, and to send the reminder if so. Only meaningful inside the 10:30–11:00
 * office-time window — the server returns `{ skipped: 'outside-window' }`
 * otherwise. Idempotent: the notification carries a per-day dedupe key, so a
 * repeat call writes nothing.
 *
 * → { success, data: { notified } | { skipped } }
 */
export const runDailyReminderCheck = async () => {
  const response = await apiClient.post('/notifications/daily-reminder-check');
  return response.data;
};
