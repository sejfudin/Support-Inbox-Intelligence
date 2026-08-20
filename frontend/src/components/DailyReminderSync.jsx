import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { isIntern } from '@/helpers/roles';
import { isWithinReminderWindow, officeDateKey } from '@/helpers/attendance';
import { useRunDailyReminderCheck } from '@/queries/notifications';
import { resolveUserId } from '@/helpers/userIdentity';

/**
 * Renders nothing. It is the on-arrival half of the daily reminder.
 *
 * The server sweeps the whole cohort once, on the first scheduler tick inside
 * the 10:30–11:00 office-time window. That sweep only reaches an intern who was
 * signed in at that moment. This asks the server to re-check *this* intern
 * whenever they turn up inside the window, so someone who opens the app at
 * 10:47 is nudged then instead of finding out at 11:00 that they missed it.
 *
 * Mounted at app level (next to `UserPreferencesSync`) rather than on the
 * dashboard, because "came onto the app" is the trigger — any page counts.
 *
 * Three things wake it: mount, the tab becoming visible again, and a one-minute
 * tick for the reader who was already sitting on the page at 10:29. All three
 * funnel through the same once-per-day guard.
 *
 * The reminder is delivered by the socket `new_notification` handler, not from
 * here — which is why it waits for the socket to be connected. Firing early
 * would create the notification while nothing was listening, and the dedupe key
 * would then block the retry that could have shown it.
 */

const CHECKED_STORAGE_KEY = 'daily-reminder-checked';
const TICK_MS = 60 * 1000;

/** `userId:YYYY-MM-DD` — the day this device already asked for this account. */
const dayStamp = (userId) => `${userId}:${officeDateKey()}`;

const alreadyChecked = (userId) => {
  try {
    return window.localStorage.getItem(CHECKED_STORAGE_KEY) === dayStamp(userId);
  } catch {
    // Private mode / storage disabled. Losing the guard costs an extra POST that
    // the server answers idempotently, so carry on rather than going silent.
    return false;
  }
};

const markChecked = (userId) => {
  try {
    window.localStorage.setItem(CHECKED_STORAGE_KEY, dayStamp(userId));
  } catch {
    /* ignore — see alreadyChecked */
  }
};

export default function DailyReminderSync() {
  const { isAuthenticated, user } = useAuth();
  const { isConnected } = useSocket();
  const { mutate: runCheck } = useRunDailyReminderCheck();

  const userId = resolveUserId(user);
  const eligible = isAuthenticated && isIntern(user?.role) && Boolean(userId) && isConnected;

  // The request is in flight; a visibility change mid-flight must not send a
  // second one before the guard is written.
  const inFlightRef = useRef(false);

  const check = useCallback(() => {
    if (!eligible) return;
    if (inFlightRef.current) return;
    if (!isWithinReminderWindow()) return;
    if (alreadyChecked(userId)) return;

    inFlightRef.current = true;
    runCheck(undefined, {
      onSuccess: (response) => {
        inFlightRef.current = false;
        // 'outside-window' means the server's office clock disagrees with ours.
        // Leave the guard unwritten so a later tick can try again.
        if (response?.data?.skipped === 'outside-window') return;
        markChecked(userId);
      },
      onError: () => {
        inFlightRef.current = false;
      },
    });
  }, [eligible, userId, runCheck]);

  useEffect(() => {
    if (!eligible) return undefined;

    check();

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    const interval = setInterval(check, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [eligible, check]);

  return null;
}
