import { readStoredPreference } from '@/hooks/useStoredPreference';
import {
  NOTIFICATION_MUTED_STORAGE_KEY,
  filterNotifications,
  isValidMutedGroups,
  parseMutedGroups,
} from './notificationPreferences';

/**
 * The macOS/Windows banner the browser draws outside the page, for a
 * notification that already arrived over the socket. This is the Notification
 * API only — no service worker, no push subscription — so a banner needs the
 * tab to still be open somewhere in the browser.
 *
 * Deliberately NOT an account preference (`ACCOUNT_PREFERENCES` in
 * `context/ThemeConfigContext.jsx`): browser permission is granted per browser,
 * per device. Syncing the switch would claim the reader opted in on a machine
 * where they never granted anything, and there it would silently do nothing.
 * This is `PREFERENCE_SCOPE.DEVICE` behaviour, cached locally and never pushed.
 *
 * The mute groups still apply. A reader who muted a group turned it off
 * everywhere, not only in the bell.
 */

export const DESKTOP_NOTIFICATIONS_STORAGE_KEY = 'notify-desktop';

const ON = 'on';
const OFF = 'off';

/** Off unless asked for — a banner nobody requested is an interruption. */
export const DESKTOP_NOTIFICATIONS_DEFAULT = OFF;

export const isValidDesktopNotifications = (value) => value === ON || value === OFF;

export const isDesktopNotificationsOn = (stored) => stored === ON;

export const desktopNotificationsValue = (on) => (on ? ON : OFF);

/** Absent in an old browser, and in any non-DOM context (tests, SSR). */
export const isDesktopNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

/**
 * `granted`, `denied`, `default`, or `unsupported`. A `denied` browser will not
 * prompt again — only the reader can undo that, in browser settings.
 */
export const getDesktopPermission = () =>
  isDesktopNotificationSupported() ? window.Notification.permission : 'unsupported';

export const requestDesktopPermission = async () => {
  if (!isDesktopNotificationSupported()) return 'unsupported';
  try {
    return await window.Notification.requestPermission();
  } catch {
    // Some browsers reject rather than resolve when the call is not
    // user-gesture driven. The stored permission is still the truth.
    return getDesktopPermission();
  }
};

/**
 * Whether the reader is looking at something other than us.
 *
 * `visibilityState` alone is not enough: it only tracks whether the *tab* is the
 * one showing in its window, so it still reads `visible` with the whole browser
 * behind another application — which is the most ordinary way to not be looking
 * at the app. `hasFocus()` covers that half.
 */
export const isAppInBackground = () =>
  document.visibilityState !== 'visible' || !document.hasFocus();

/**
 * Whether one incoming notification earns a banner. Pure, so the four
 * conditions are testable without a DOM.
 *
 * `appInBackground` matters: with the app on screen the bell badge already says
 * it, and a banner over the page the reader is looking at is pure noise.
 */
export const shouldShowDesktopNotification = ({
  notification,
  enabled,
  permission,
  appInBackground,
  mutedGroups = [],
}) => {
  if (!enabled) return false;
  if (permission !== 'granted') return false;
  if (!appInBackground) return false;
  if (!notification?.title) return false;
  return filterNotifications([notification], mutedGroups).length > 0;
};

/**
 * Draws the banner. Returns the `Notification`, or `null` when the browser
 * refused it — callers treat a banner as best-effort and never branch on it.
 *
 * `tag` replaces an earlier banner with the same tag instead of stacking a
 * second one, which matters for a reminder that can re-fire.
 */
export const showDesktopNotification = ({ title, body, tag, onClick }) => {
  if (!isDesktopNotificationSupported()) return null;

  try {
    const notification = new window.Notification(title, { body, tag });

    notification.onclick = () => {
      window.focus();
      notification.close();
      onClick?.();
    };

    return notification;
  } catch {
    // Constructing throws where the API exists but is service-worker-only
    // (Android Chrome). Nothing to recover — the bell already has the entry.
    return null;
  }
};

/**
 * The whole thing, for one arriving notification: read the switch, ask the
 * browser where it stands, apply the mutes, draw if all of it holds.
 *
 * Every value is read at call time rather than held in React state, because the
 * caller is a socket handler — a cached switch or permission would be whatever
 * it was when the socket connected, not what it is now.
 *
 * Safe to call for every notification. Returns the banner, or `null`.
 */
export const maybeShowDesktopNotification = (notification, { onClick } = {}) => {
  const stored = readStoredPreference(
    DESKTOP_NOTIFICATIONS_STORAGE_KEY,
    DESKTOP_NOTIFICATIONS_DEFAULT,
    isValidDesktopNotifications
  );

  const muted = readStoredPreference(NOTIFICATION_MUTED_STORAGE_KEY, '', isValidMutedGroups);

  const allowed = shouldShowDesktopNotification({
    notification,
    enabled: isDesktopNotificationsOn(stored),
    permission: getDesktopPermission(),
    appInBackground: isAppInBackground(),
    mutedGroups: parseMutedGroups(muted),
  });

  if (!allowed) return null;

  return showDesktopNotification({
    title: notification.title,
    body: notification.body,
    // One banner per notification: a re-fire replaces it rather than stacking
    // a second copy of the same nudge.
    tag: String(notification._id || notification.id || notification.type),
    onClick,
  });
};
