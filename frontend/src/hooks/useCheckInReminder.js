import { isWeekend } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { isIntern } from '@/helpers/roles';
import { useMyAttendance } from '@/queries/attendance';
import {
  isCheckedInToday,
  checkInWindowState,
  exemptFromKey,
  officeDateKey,
  CHECK_IN_WINDOW_LABEL,
} from '@/helpers/attendance';

/**
 * Whether the signed-in intern still needs to check in today, and a message for
 * the reminder banner + bell notification. The reminder is "active" only for
 * interns, while the check-in window is open, and before they've checked in
 * (including after a cancel/uncheck). It clears automatically once they check in
 * or the window closes.
 *
 * An intern already on a real project (`placedAt`) is never reminded — they owe no
 * attendance, and the server would refuse the check-in anyway. Back-dating
 * `placedAt` silences the banner and the bell from the next render.
 *
 * @returns {{ active: boolean, title: string, body: string, windowLabel: string }}
 */
export function useCheckInReminder() {
  const { user } = useAuth();
  const intern = isIntern(user?.role);

  // Only fetch attendance for interns; other roles never see this reminder.
  const { data } = useMyAttendance({ enabled: intern });

  const records = data?.records ?? [];
  const exemptFrom = exemptFromKey(data?.placedAt);
  const onProject = Boolean(exemptFrom) && officeDateKey() >= exemptFrom;

  const windowState = checkInWindowState();
  const active =
    intern &&
    !onProject &&
    !isWeekend(new Date()) &&
    windowState === 'open' &&
    !isCheckedInToday(records);

  return {
    active,
    title: 'Check in for today',
    body: `You haven't checked in yet. The check-in window (${CHECK_IN_WINDOW_LABEL}) is open — record your attendance before it closes.`,
    windowLabel: CHECK_IN_WINDOW_LABEL,
  };
}
