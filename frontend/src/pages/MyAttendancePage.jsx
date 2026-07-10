import { PageShell, PageSection } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import CheckInCard from '@/components/attendance/CheckInCard';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceStat from '@/components/attendance/AttendanceStat';
import { CalendarCheck, Flame, Percent, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useMyAttendance, useCheckInToday, useCancelTodayCheckIn } from '@/queries/attendance';
import {
  computeStreak,
  attendanceRateTextClass,
  currentMonthAttendance,
} from '@/helpers/attendance';

export default function MyAttendancePage() {
  const { data, isPending, isError } = useMyAttendance();
  const { mutate: checkIn, isPending: isCheckingIn } = useCheckInToday();
  const { mutate: cancelCheckIn, isPending: isCancelling } = useCancelTodayCheckIn();

  const records = data?.records ?? [];
  const cancelledDates = data?.cancelledDates ?? [];
  const { rate: attendanceRate, present: presentDays, workingDaysElapsed } =
    currentMonthAttendance(records);
  const streak = computeStreak(records);
  const monthLabel = format(new Date(), 'MMMM');

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <PageHeading
            kicker="Internship"
            title="My attendance"
            subtitle="Check in each day you come into the office. Your mentor and admins can see your attendance, but only you can record it."
            showMetaDivider
            meta={
              <div
                className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3 text-sm text-muted-foreground"
                data-test="attendance-performance-notice"
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p>
                  Your attendance is part of how your performance is assessed. Only be absent when
                  you've agreed it in advance with your mentor and have their permission — unplanned
                  absences count against you.
                </p>
              </div>
            }
          />

          {isError && (
            <div className="app-panel p-6 text-sm text-destructive" data-test="attendance-error">
              Failed to load your attendance. Please try again.
            </div>
          )}

          {isPending && (
            <div className="app-panel p-6 text-sm text-muted-foreground">Loading your attendance…</div>
          )}

          {!isPending && !isError && (
            <>
              <CheckInCard
                records={records}
                cancelledDates={cancelledDates}
                onCheckIn={() => checkIn()}
                onCancel={() => cancelCheckIn()}
                isCheckingIn={isCheckingIn}
                isCancelling={isCancelling}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <AttendanceStat
                  label="Attendance"
                  value={`${attendanceRate}%`}
                  hint={`${monthLabel} so far`}
                  icon={Percent}
                  valueClassName={attendanceRateTextClass(attendanceRate)}
                />
                <AttendanceStat
                  label="Days present"
                  value={`${presentDays} / ${workingDaysElapsed}`}
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
            </>
          )}
        </div>
      </PageSection>
    </PageShell>
  );
}
