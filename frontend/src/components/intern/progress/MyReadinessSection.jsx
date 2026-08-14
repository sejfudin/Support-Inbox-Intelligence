import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/helpers/date';
import { getReadinessBadgeClassName } from '@/helpers/internProfile';
import { ReadinessLevelBadge } from '@/components/interns/ReadinessLevelBadge';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { ProgressPanel, ProgressPanelBody } from './ProgressPanel';

/**
 * Who assessed a level and when, or the nudge when nobody has yet.
 *
 * "Not assessed" is the actionable state on this page — it is the list of things
 * to raise with a mentor — so it gets a sentence rather than an em dash.
 *
 * Keyed on the level, NOT on whether a flag row exists. A flag explicitly set to
 * `none` and a technology with no flag at all mean the same thing to the intern
 * ("nobody has assessed this"), and reading `assessedBy` first put "Assessed by
 * Ana" directly under a "Not assessed" badge — a contradiction on the same row for
 * a distinction the intern has no use for.
 */
function AssessmentLine({ row }) {
  if (row.level === 'none') {
    return <span className="text-xs text-muted-foreground">Not assessed yet</span>;
  }

  return (
    <span className="text-xs text-muted-foreground">
      {row.assessedBy ? `Assessed by ${row.assessedBy}` : 'Assessed'}
      {row.assessedAt ? ` · ${formatDate(row.assessedAt)}` : ''}
    </span>
  );
}

/** One count chip in the summary row, tinted with that level's own colour. */
function LevelCount({ level, label, count }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold',
        getReadinessBadgeClassName(level)
      )}
    >
      <span className="tabular-nums">{count}</span>
      {label}
    </span>
  );
}

/**
 * "Placement readiness" — the levels a mentor has recorded for the intern's
 * position and each technology they have declared.
 *
 * Read-only: setting a level is admin-only (`readinessFlagService.upsertReadinessFlag`).
 * The rows come from what the intern has *declared*, so a technology nobody has
 * looked at yet appears as "Not assessed" instead of silently missing — that gap is
 * the useful part.
 */
export function MyReadinessSection({ readiness }) {
  const position = readiness?.position || null;
  const technologies = readiness?.technologies || [];
  const summary = readiness?.summary || { total: 0, ready: 0, learning: 0, none: 0 };

  return (
    <ProgressPanel
      title="Placement readiness"
      description="How ready your mentor considers you for your position and for each technology you have declared."
      action={
        summary.total > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <LevelCount level="ready" label="Ready" count={summary.ready} />
            <LevelCount level="learning" label="Learning" count={summary.learning} />
            <LevelCount level="none" label="Not assessed" count={summary.none} />
          </div>
        ) : null
      }
      dataTour="my-progress-readiness"
    >
      <ProgressPanelBody className="space-y-5">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            By position
          </h3>
          {position ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{position.name}</p>
                <AssessmentLine row={position} />
              </div>
              <ReadinessLevelBadge level={position.level} />
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              You haven&apos;t declared a position yet.{' '}
              <Link
                to="/my-technologies"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Declare one
              </Link>{' '}
              and your mentor can assess your readiness for it.
            </p>
          )}
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            By technology
          </h3>
          {technologies.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              You haven&apos;t declared any technologies yet.{' '}
              <Link
                to="/my-technologies"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Add the ones you are working toward
              </Link>{' '}
              — each one your mentor assesses shows up here.
            </p>
          ) : (
            /* Ready first, then learning, then unassessed — the order the server
               sorts them in, matching the admin's own grid so the two views of the
               same assessment read the same way. */
            <ul className="mt-2 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
              {technologies.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TechnologyIcon technology={row} size={18} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                      <AssessmentLine row={row} />
                    </div>
                  </div>
                  <ReadinessLevelBadge level={row.level} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {summary.none > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">
            {summary.none} of your {summary.total} technolog
            {summary.total === 1 ? 'y' : 'ies'} {summary.none === 1 ? 'has' : 'have'} not been
            assessed yet — worth raising at your next 1-on-1.
            <Link
              to="/my-technologies"
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              Manage my technologies
              <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        )}
      </ProgressPanelBody>
    </ProgressPanel>
  );
}
