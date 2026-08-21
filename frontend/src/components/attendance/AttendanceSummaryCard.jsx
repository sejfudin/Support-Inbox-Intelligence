import { cn } from '@/lib/utils';

/**
 * The intern's three headline numbers, as a compact list beside the calendar.
 *
 * Deliberately not the three `AttendanceStat` tiles the admin roster uses. Those
 * are a row across the full width of a page; here they sit in a narrow right-hand
 * column next to a calendar, and three tiles stacked in a column read as three
 * separate cards competing with the one thing that matters — the month itself.
 *
 * Each row is "label · qualifier" on the left and the number hard right, so the
 * numbers form a single scannable edge.
 */
function SummaryRow({ label, hint, value, valueClassName, testId }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5" data-test={testId}>
      <span className="text-sm text-muted-foreground">
        {label}
        {hint && <span className="text-muted-foreground/60"> · {hint}</span>}
      </span>
      <span className={cn('text-lg font-semibold tabular-nums text-foreground', valueClassName)}>
        {value}
      </span>
    </div>
  );
}

export default function AttendanceSummaryCard({
  attendanceRateLabel,
  attendanceRateClassName,
  presentDays,
  workingDays,
  streak,
  monthLabel,
  onProject = false,
}) {
  return (
    <div
      className="app-card divide-y divide-border/60 px-4 py-1 md:px-5"
      data-test="attendance-summary-card"
    >
      <SummaryRow
        label="Attendance"
        hint={onProject ? 'not required' : `${monthLabel} so far`}
        value={attendanceRateLabel}
        valueClassName={attendanceRateClassName}
        testId="attendance-summary-rate"
      />
      <SummaryRow
        label="Days present"
        hint="working days"
        value={`${presentDays} / ${workingDays}`}
        testId="attendance-summary-present"
      />
      <SummaryRow
        label="Current streak"
        hint={streak === 1 ? 'day' : 'days'}
        value={streak}
        testId="attendance-summary-streak"
      />
    </div>
  );
}
