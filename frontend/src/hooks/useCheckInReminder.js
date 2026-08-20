import { useAuth } from '@/context/AuthContext';
import { isIntern } from '@/helpers/roles';
import { useMyAttendance } from '@/queries/attendance';
import {
  isCheckedInToday,
  checkInWindowState,
  exemptFromKey,
  isOfficeWeekend,
  nonWorkingKeySet,
  officeDateKey,
  requestedStatusToday,
  CHECK_IN_WINDOW_LABEL,
} from '@/helpers/attendance';

/**
 * Whether the signed-in intern still needs to check in today, and a message for
 * the reminder banner + bell notification. The reminder is "active" only for
 * interns, while the check-in window is open, and before they've checked in
 * (including after a cancel/uncheck). It clears automatically once they check in
 * or the window closes.
 *
 * Nobody is reminded to do something they cannot do. The banner is silent on
 * every day the server would refuse the check-in on: an intern already on a real
 * project (`placedAt`), a day an approval already spoke for (vacation, sick,
 * religious, or remote — remote is work and already counts), and a day the whole
 * cohort was excused (public holiday, programme break, remote week). Nagging
 * someone on approved leave to record attendance is worse than saying nothing.
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
  const todayKey = officeDateKey();
  const onProject = Boolean(exemptFrom) && todayKey >= exemptFrom;
  // Truthy for remote as well as the three kinds of leave: a remote day already
  // counts as attended, so there is nothing left to remind anyone about.
  const onApprovedDay = Boolean(requestedStatusToday(data?.requestedDays));
  const cohortDayOff = nonWorkingKeySet(data?.nonWorkingDays).has(todayKey);

  const windowState = checkInWindowState();
  const active =
    intern &&
    !onProject &&
    !onApprovedDay &&
    !cohortDayOff &&
    // Office time, not the browser's: at 22:00 in UTC-5 it is already Saturday in
    // Sarajevo, and the reminder has to agree with the day the server is keying on.
    !isOfficeWeekend() &&
    windowState === 'open' &&
    !isCheckedInToday(records);

  return {
    active,
    title: 'Check in for today',
    body: `You haven't checked in yet. The check-in window (${CHECK_IN_WINDOW_LABEL}) is open — record your attendance before it closes.`,
    windowLabel: CHECK_IN_WINDOW_LABEL,
  };
}
