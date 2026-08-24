import { format, parseISO } from 'date-fns';
import { Percent, CalendarCheck, Flame } from 'lucide-react';
import { DetailModal } from '@/components/interns/DetailModal';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceStat from '@/components/attendance/AttendanceStat';
import { useInternAttendance } from '@/queries/attendance';
import {
  computeStreak,
  attendanceRateTextClass,
  formatAttendanceRate,
  isExemptToday,
} from '@/helpers/attendance';
import { Loader, useLoaderHold } from '@/components/ui/loader';

/**
 * Admin-only read-only calendar view of one intern's attendance, opened from the
 * roster. Reuses the intern-side calendar + stat tiles (no check-in card — only
 * interns record their own attendance). Opens on and reports the same `month` the
 * roster is showing.
 *
 * @param {{ intern: { id, fullname, email, hub } | null, month: string, onClose: () => void }} props
 */
export default function InternAttendanceModal({ intern, month, onClose }) {
  const open = Boolean(intern);
  const { data, isPending: isPendingRaw, isError } = useInternAttendance(intern?.id, month);
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });

  const monthLabel = month ? format(parseISO(`${month}-01`), 'MMMM yyyy') : '';
  const records = data?.records ?? [];
  const cancelledDates = data?.cancelledDates ?? [];
  const stats = data?.month ?? {};
  const placedAt = data?.placedAt ?? null;
  const nonWorkingDays = data?.nonWorkingDays ?? [];
  const startDate = data?.startDate ?? null;
  const requestedDays = data?.requestedDays ?? {};
  const observances = data?.observances ?? [];
  const placementExemptions = data?.placementExemptions ?? [];
  const streak = computeStreak(records, placedAt);

  let content;
  if (isPending) {
    content = <Loader className="py-10" label="Loading attendance…" />;
  } else if (isError) {
    content = (
      <p className="py-10 text-center text-sm text-[hsl(var(--tone-danger-fg))]">
        Failed to load attendance.
      </p>
    );
  } else {
    content = (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <AttendanceStat
            label="Attendance"
            value={formatAttendanceRate(stats.attendanceRate)}
            hint={isExemptToday(placedAt) ? 'On project — not required' : monthLabel}
            icon={Percent}
            valueClassName={attendanceRateTextClass(stats.attendanceRate)}
          />
          <AttendanceStat
            label="Days present"
            value={`${stats.presentDays ?? 0} / ${stats.workingDays ?? 0}`}
            hint="Working days"
            icon={CalendarCheck}
          />
          <AttendanceStat
            label="Current streak"
            value={streak}
            hint={streak === 1 ? 'day' : 'days'}
            icon={Flame}
          />
        </div>
        <AttendanceCalendar
          records={records}
          cancelledDates={cancelledDates}
          initialMonth={month}
          placedAt={placedAt}
          nonWorkingDays={nonWorkingDays}
          startDate={startDate}
          requestedDays={requestedDays}
          placementExemptions={placementExemptions}
          observances={observances}
        />
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
