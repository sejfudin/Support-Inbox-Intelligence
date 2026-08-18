import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// An evaluation criterion is scored 1–5 as a whole number, so the scale is drawn
// as five discrete pips rather than a continuous bar: a bar at 60% invites the
// reader to interpolate a precision the score does not have.
const SCALE_MAX = 5;
const STEPS = Array.from({ length: SCALE_MAX }, (_, index) => index + 1);

/**
 * How a score moved since the previous review period.
 *
 * A `null` delta ("no earlier period to compare with") renders nothing — there is
 * no movement to report. A delta of exactly `0` is real information and gets its
 * own quiet dash rather than being folded in with "unknown": held steady and
 * never-measured are different facts about someone's progress.
 */
export function ScoreDelta({ delta, className }) {
  if (delta === null || delta === undefined) return null;

  const Icon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
        delta === 0 && 'bg-muted text-muted-foreground',
        delta > 0 && 'bg-[hsl(var(--tone-success)/0.12)] text-[hsl(var(--tone-success-fg))]',
        delta < 0 && 'bg-[hsl(var(--tone-danger)/0.12)] text-[hsl(var(--tone-danger-fg))]',
        className
      )}
      title="Change since the previous review period"
    >
      <Icon className="h-3 w-3" />
      {delta === 0 ? 'Same' : `${delta > 0 ? '+' : ''}${delta}`}
    </span>
  );
}

/**
 * One criterion of one evaluation: its label, the score as five pips, the number,
 * and optionally how it moved since the previous period.
 *
 * The pips are a single `role="img"` with the score spelled out, not five
 * decorative divs — a screen reader gets "Communication: 4 out of 5" once instead
 * of nothing at all.
 */
export function ScoreScale({ label, score, delta = null, className }) {
  const hasScore = Number.isFinite(score);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="w-[6.5rem] shrink-0 truncate text-xs font-medium text-muted-foreground">
        {label}
      </span>

      <span
        className="flex min-w-0 flex-1 items-center gap-1"
        role="img"
        aria-label={hasScore ? `${label}: ${score} out of ${SCALE_MAX}` : `${label}: not scored`}
      >
        {STEPS.map((step) => (
          <span
            key={step}
            aria-hidden="true"
            className={cn(
              'h-1.5 min-w-0 flex-1 rounded-full transition-colors',
              hasScore && step <= score ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </span>

      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
        {hasScore ? `${score}/5` : '—'}
      </span>

      {/* Fixed-width slot so the pip scales above each other stay aligned whether or
          not a given criterion has a comparison. */}
      <span className="flex w-[4.25rem] shrink-0 justify-end">
        <ScoreDelta delta={delta} />
      </span>
    </div>
  );
}
