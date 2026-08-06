import { cn } from '@/lib/utils';

// Thresholds mirror how the attendance roster reads a rate: healthy, slipping,
// and needs attention. Tokenised colours so the meter stays legible in every theme.
const rateTone = (rate) => {
  if (rate >= 90) return 'bg-emerald-500';
  if (rate >= 80) return 'bg-amber-500';
  return 'bg-destructive';
};

/**
 * This month's attendance rate as a bar + percentage. The rate is prorated
 * server-side against elapsed working days since the intern's start date and
 * clamped at `placedAt`, so neither a mid-month joiner nor an intern who has moved
 * onto a real project is penalised — see helpers/attendanceStats.js.
 *
 * `rate` is null when nothing was owed. That renders as an empty track and a dash:
 * showing 0% would invent a measurement and read as a month of absences.
 */
export function AttendanceMeter({ rate = null, presentDays, workingDays }) {
  if (typeof rate !== 'number') {
    return (
      <div className="flex items-center gap-3">
        <div
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50"
          role="img"
          aria-label="No attendance required this month"
        />
        <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
          —
        </span>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, rate));
  const hasDays = Number.isFinite(presentDays) && Number.isFinite(workingDays);

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={
          hasDays
            ? `${clamped}% attendance, ${presentDays} of ${workingDays} working days`
            : `${clamped}% attendance`
        }
      >
        <div
          className={cn('h-full rounded-full transition-all', rateTone(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
        {clamped}%
      </span>
    </div>
  );
}
