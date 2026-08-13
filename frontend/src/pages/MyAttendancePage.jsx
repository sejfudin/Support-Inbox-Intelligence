import { PageShell, PageSection } from '@/components/PageShell';
import AttendanceHeaderCard from '@/components/attendance/AttendanceHeaderCard';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceSummaryCard from '@/components/attendance/AttendanceSummaryCard';
import AttendanceRequestPanel from '@/components/attendance/AttendanceRequestPanel';
import { Info } from 'lucide-react';
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
  const requestedDays = data?.requestedDays ?? {};
  const observances = data?.observances ?? [];
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
      {/* No inner width cap: `PageSection` already carries the app-wide
          `max-w-[112rem] px-12`, the same bounds Tickets and the rest of the app
          use. This page used to narrow itself again on top of that, which left it
          floating in a column while every neighbouring page ran full width. */}
      <PageSection className="space-y-5">
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
            <AttendanceHeaderCard
              records={records}
              cancelledDates={cancelledDates}
              placedAt={placedAt}
              requestedDays={requestedDays}
              onCheckIn={() => checkIn()}
              onCancel={() => cancelCheckIn()}
              isCheckingIn={isCheckingIn}
              isCancelling={isCancelling}
            />

            {/* Both notices are addressed to someone who still has to check in. Once
                the intern is on a project neither is true any more, and leaving the
                amber "unplanned absences count against you" up would be actively
                misleading — so it is replaced by the reason their days are greyed
                out. */}
            {onProject ? (
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
                  you've agreed it in advance with your mentor — unplanned absences count against
                  you.
                </p>
              </div>
            )}

            {/* `items-stretch` is what aligns the two columns' bottom edges: the
                calendar grows its day cells to meet the balance card rather than
                ending early and leaving a ragged step between them. The calendar is
                the subject of the page, so it takes the wide column. Single column
                below `lg` — a month grid and a sidebar cannot both be legible on a
                phone. */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-stretch">
              <AttendanceCalendar
                records={records}
                cancelledDates={cancelledDates}
                placedAt={placedAt}
                nonWorkingDays={nonWorkingDays}
                startDate={startDate}
                requestedDays={requestedDays}
                observances={observances}
              />

              <div className="flex flex-col gap-5">
                <AttendanceSummaryCard
                  attendanceRateLabel={formatAttendanceRate(attendanceRate)}
                  attendanceRateClassName={attendanceRateTextClass(attendanceRate)}
                  presentDays={presentDays}
                  workingDays={workingDaysElapsed}
                  streak={streak}
                  monthLabel={monthLabel}
                  onProject={onProject}
                />

                {/* Withdrawn once the intern is on a project: they no longer record
                    attendance at all, so there is nothing to request against.
                    `recordedDates` are the days that already have attendance — the
                    request calendar greys them out rather than letting the intern
                    pick a day the server is bound to refuse. */}
                {!onProject && (
                  <AttendanceRequestPanel
                    className="flex-1"
                    recordedDates={records.map((r) => r.date)}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </PageSection>
    </PageShell>
  );
}
