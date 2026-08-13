import { PageShell, PageSection } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import CheckInCard from '@/components/attendance/CheckInCard';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceStat from '@/components/attendance/AttendanceStat';
import RemoteWorkPanel from '@/components/attendance/RemoteWorkPanel';
import { CalendarCheck, Flame, Percent, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useMyAttendance, useCheckInToday, useCancelTodayCheckIn } from '@/queries/attendance';
import {
  computeStreak,
  attendanceRateTextClass,
  formatAttendanceRate,
  isExemptToday,
} from '@/helpers/attendance';

export default function MyAttendancePage() {
  const { data, isPending, isError } = useMyAttendance();
  const { mutate: checkIn, isPending: isCheckingIn } = useCheckInToday();
  const { mutate: cancelCheckIn, isPending: isCancelling } = useCancelTodayCheckIn();

  const records = data?.records ?? [];
  const cancelledDates = data?.cancelledDates ?? [];
  // First day on a real project, if any — from there the intern owes no attendance.
  const placedAt = data?.placedAt ?? null;
  const nonWorkingDays = data?.nonWorkingDays ?? [];
  const startDate = data?.startDate ?? null;
  const remoteDates = data?.remoteDates ?? [];
  // Current-month stats come from the server (start-date-prorated, and clamped at
  // `placedAt`); the calendar and streak are derived client-side from the full
  // record history. `attendanceRate` is null when nothing was owed — do NOT default
  // it to 0, which would show a fabricated 0%.
  const {
    attendanceRate = null,
    presentDays = 0,
    workingDays: workingDaysElapsed = 0,
  } = data?.month ?? {};
  const streak = computeStreak(records, placedAt);
  const monthLabel = format(new Date(), 'MMMM');
  // Already on the project as of today (a future placedAt still owes attendance).
  const onProject = isExemptToday(placedAt);

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          {/* Both the subtitle and the performance warning are addressed to someone
              who still has to check in. Once the intern is on a project neither is
              true any more, and leaving the amber "unplanned absences count against
              you" notice up would be actively misleading — so it is replaced by the
              reason their days are greyed out. */}
          <PageHeading
            kicker="Internship"
            title="My attendance"
            subtitle={
              onProject
                ? 'You are on a project, so you no longer record daily attendance. Your history up to that point is below.'
                : // Admins only — mentors have no attendance view. Saying "your mentor"
                  // here was untrue, and an intern who believed it would think a day
                  // off had been seen by someone who cannot see it.
                  'Check in each day you come into the office. Admins can see your attendance, but only you can record it.'
            }
            showMetaDivider
            meta={
              onProject ? (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground"
                  data-test="attendance-on-project-notice"
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p>
                    Attendance stopped counting on{' '}
                    <span className="font-semibold text-foreground">
                      {format(new Date(placedAt), 'MMMM d, yyyy')}
                    </span>
                    , the day you started on a project. Days from then on are greyed out — they are
                    not absences.
                  </p>
                </div>
              ) : (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3 text-sm text-muted-foreground"
                  data-test="attendance-performance-notice"
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p>
                    Your attendance is part of how your performance is assessed. Only be absent when
                    you've agreed it in advance with your mentor and have their permission —
                    unplanned absences count against you.
                  </p>
                </div>
              )
            }
          />

          {isError && (
            <div className="app-panel p-6 text-sm text-destructive" data-test="attendance-error">
              Failed to load your attendance. Please try again.
            </div>
          )}

          {isPending && (
            <div className="app-panel p-6 text-sm text-muted-foreground">
              Loading your attendance…
            </div>
          )}

          {!isPending && !isError && (
            <>
              <CheckInCard
                records={records}
                cancelledDates={cancelledDates}
                placedAt={placedAt}
                onCheckIn={() => checkIn()}
                onCancel={() => cancelCheckIn()}
                isCheckingIn={isCheckingIn}
                isCancelling={isCancelling}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <AttendanceStat
                  label="Attendance"
                  value={formatAttendanceRate(attendanceRate)}
                  hint={onProject ? 'Not required — on a project' : `${monthLabel} so far`}
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

              {/* Withdrawn once the intern is on a project: they no longer record
                  attendance at all, so there is nothing to work remotely against.
                  `recordedDates` are the days that already have attendance — the
                  request calendar greys them out rather than letting the intern
                  pick a day the server is bound to refuse. */}
              {!onProject && <RemoteWorkPanel recordedDates={records.map((r) => r.date)} />}

              <AttendanceCalendar
                records={records}
                cancelledDates={cancelledDates}
                placedAt={placedAt}
                nonWorkingDays={nonWorkingDays}
                startDate={startDate}
                remoteDates={remoteDates}
              />
            </>
          )}
        </div>
      </PageSection>
    </PageShell>
  );
}
