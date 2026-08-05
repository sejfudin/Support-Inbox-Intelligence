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
 * server-side against elapsed working days since the intern's start date, so a
 * mid-month joiner is not penalised — see helpers/attendanceStats.js.
 */
export function AttendanceMeter({ rate = 0, presentDays, workingDays }) {
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
