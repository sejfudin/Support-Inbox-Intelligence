import { format } from 'date-fns';
import { Percent, CalendarCheck, Flame } from 'lucide-react';
import { DetailModal } from '@/components/interns/DetailModal';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceStat from '@/components/attendance/AttendanceStat';
import { useInternAttendance } from '@/queries/attendance';
import { computeStreak, attendanceRateTextClass } from '@/helpers/attendance';

/**
 * Admin-only read-only calendar view of one intern's attendance, opened from the
 * roster. Reuses the intern-side calendar + stat tiles (no check-in card — only
 * interns record their own attendance).
 *
 * @param {{ intern: { id, fullname, email, hub } | null, onClose: () => void }} props
 */
export default function InternAttendanceModal({ intern, onClose }) {
  const open = Boolean(intern);
  const { data, isPending, isError } = useInternAttendance(intern?.id, { enabled: open });

  const monthLabel = format(new Date(), 'MMMM');
  const records = data?.records ?? [];
  const cancelledDates = data?.cancelledDates ?? [];
  const month = data?.month ?? {};
  const streak = computeStreak(records);

  let content;
  if (isPending) {
    content = (
      <p className="py-10 text-center text-sm text-muted-foreground">Loading attendance…</p>
    );
  } else if (isError) {
    content = (
      <p className="py-10 text-center text-sm text-destructive">Failed to load attendance.</p>
    );
  } else {
    content = (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <AttendanceStat
            label="Attendance"
            value={`${month.attendanceRate ?? 0}%`}
            hint={`${monthLabel} so far`}
            icon={Percent}
            valueClassName={attendanceRateTextClass(month.attendanceRate ?? 0)}
          />
          <AttendanceStat
            label="Days present"
            value={`${month.presentDays ?? 0} / ${month.workingDays ?? 0}`}
            hint={`${monthLabel} working days`}
            icon={CalendarCheck}
          />
          <AttendanceStat
            label="Current streak"
            value={streak}
            hint={streak === 1 ? 'day' : 'days'}
            icon={Flame}
          />
        </div>
        <AttendanceCalendar records={records} cancelledDates={cancelledDates} />
      </div>
    );
  }

  return (
    <DetailModal
      open={open}
      onClose={onClose}
      title={intern?.fullname || 'Attendance'}
      subtitle={intern ? [intern.email, intern.hub].filter(Boolean).join(' · ') : undefined}
      className="max-w-2xl"
      dataTest="attendance-intern-modal"
      sections={[{ content }]}
    />
  );
}
