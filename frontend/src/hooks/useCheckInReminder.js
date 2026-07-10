import { useAuth } from '@/context/AuthContext';
import { isIntern } from '@/helpers/roles';
import { useMyAttendance } from '@/queries/attendance';
import {
  isCheckedInToday,
  isCancelledToday,
  checkInWindowState,
  CHECK_IN_WINDOW_LABEL,
} from '@/helpers/attendance';

/**
 * Whether the signed-in intern still needs to check in today, and a message for
 * the reminder banner + bell notification. The reminder is "active" only for
 * interns, while the check-in window is open, and before they've checked in or
 * cancelled. It clears automatically once any of those change.
 *
 * @returns {{ active: boolean, title: string, body: string, windowLabel: string }}
 */
export function useCheckInReminder() {
  const { user } = useAuth();
  const intern = isIntern(user?.role);

  // Only fetch attendance for interns; other roles never see this reminder.
  const { data } = useMyAttendance({ enabled: intern });

  const records = data?.records ?? [];
  const cancelledDates = data?.cancelledDates ?? [];

  const windowState = checkInWindowState();
  const active =
    intern &&
    windowState === 'open' &&
    !isCheckedInToday(records) &&
    !isCancelledToday(cancelledDates);

  return {
    active,
    title: 'Check in for today',
    body: `You haven't checked in yet. The check-in window (${CHECK_IN_WINDOW_LABEL}) is open — record your attendance before it closes.`,
    windowLabel: CHECK_IN_WINDOW_LABEL,
  };
}
