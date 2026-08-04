import { format } from 'date-fns';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DashboardCard,
  DashboardCardEmpty,
  DashboardCardHelp,
} from '@/components/dashboard/DashboardCard';
import { ExampleChip } from './ExampleChip';

// How many past periods the card lists before it stops. The rail is the shorter
// column; beyond three rows it starts driving the whole row's height.
const VISIBLE_PERIODS = 3;

const formatPeriod = (evaluation) =>
  `${format(new Date(evaluation.periodStart), 'MMM d, yyyy')} – ${format(
    new Date(evaluation.periodEnd),
    'MMM d, yyyy'
  )}`;

/**
 * "My evaluations" — the intern's own score history.
 *
 * The payload is redacted server-side (`evaluationService.listOwnEvaluations`):
 * scores, periods and who wrote them, but never the evaluation `notes`, which
 * are written for an internal audience rather than addressed to the intern.
 */
/** Shared between the empty and populated card, so the "?" never disappears. */
function EvaluationsHelp() {
  return (
    <DashboardCardHelp label="About my evaluations">
      <p>
        Your mentor scores you out of 5 at the end of each review period. The big number is your
        latest; the rows below it are earlier periods, newest first.
      </p>
      <p>
        The chip next to the title is the change since the previous period. The written notes behind
        a score are not shown here — ask your mentor for those.
      </p>
    </DashboardCardHelp>
  );
}

export function MyEvaluationsCard({ evaluations, className, isPreview = false }) {
  const latest = evaluations?.latest;
  const delta = evaluations?.delta;
  const items = evaluations?.items || [];

  if (!latest) {
    return (
      <DashboardCard
        className={className}
        title="My evaluations"
        action={<EvaluationsHelp />}
        data-tour="intern-dashboard-evaluations"
      >
        <DashboardCardEmpty>
          No evaluation recorded yet. Your mentor writes one at the end of each review period.
        </DashboardCardEmpty>
      </DashboardCard>
    );
  }

  // A zero delta is real information ("held steady") but reads as noise next to
  // an arrow, so only a genuine move gets a chip.
  const moved = typeof delta === 'number' && delta !== 0;
  const TrendIcon = delta > 0 ? TrendingUp : TrendingDown;

  return (
    <DashboardCard
      className={className}
      title="My evaluations"
      action={
        <div className="flex shrink-0 items-center gap-1.5">
          {isPreview && <ExampleChip />}
          {moved && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                delta > 0
                  ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-500/12 text-red-700 dark:text-red-300'
              )}
              title="Change since the previous period"
            >
              <TrendIcon className="h-3 w-3" />
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
          <EvaluationsHelp />
        </div>
      }
      data-tour="intern-dashboard-evaluations"
    >
      <p className="flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold leading-none tabular-nums text-foreground">
          {latest.averageScore ?? '—'}
        </span>
        <span className="text-sm font-medium text-muted-foreground">/ 5</span>
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Latest: {latest.evaluator || 'Your mentor'} · {format(new Date(latest.periodEnd), 'MMM d')}
      </p>

      <ul className="mt-4 space-y-2">
        {items.slice(0, VISIBLE_PERIODS).map((evaluation) => (
          <li
            key={evaluation.id}
            className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-medium text-foreground">
                {formatPeriod(evaluation)}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {evaluation.evaluator}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {evaluation.averageScore ?? '—'}
            </span>
          </li>
        ))}
      </ul>

      {items.length > VISIBLE_PERIODS && (
        <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
          {items.length - VISIBLE_PERIODS} earlier period
          {items.length - VISIBLE_PERIODS === 1 ? '' : 's'} not shown
        </p>
      )}
    </DashboardCard>
  );
}
