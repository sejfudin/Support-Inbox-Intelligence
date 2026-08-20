import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/helpers/date';
import { getReadinessBadgeClassName } from '@/helpers/internProfile';
import { ReadinessLevelBadge } from '@/components/interns/ReadinessLevelBadge';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { ProgressGroupLabel, ProgressPanel } from './ProgressPanel';

const ACTION_CLASS = 'h-[34px] shrink-0 rounded-[var(--r-control)] px-3.5 text-[12.5px]';

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
    return <span className="text-[11.5px] text-muted-foreground">Not assessed yet</span>;
  }

  return (
    <span className="text-[11.5px] text-muted-foreground">
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[10.5px] font-semibold',
        getReadinessBadgeClassName(level)
      )}
    >
      <span className="tabular-nums">{count}</span>
      {label}
    </span>
  );
}

/**
 * One row of the flat list: what was assessed, who assessed it, and the level.
 *
 * A row, not a card. Position and technologies used to be two inset blocks, and
 * each technology a bordered tile inside one of them — three frames deep for a
 * list of names and levels, with a ragged last row whenever the count was odd.
 */
function ReadinessRow({ icon, name, row }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-separator px-[18px] py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-foreground">{name}</p>
          <AssessmentLine row={row} />
        </div>
      </div>
      <ReadinessLevelBadge level={row.level} />
    </li>
  );
}

/** The empty half of a block: what is missing, and the button that fixes it. */
function DeclarePrompt({ children, action, variant }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-[16rem] flex-1 text-[12.5px] leading-[1.55] text-muted-foreground">
        {children}
      </p>
      <Button asChild variant={variant} className={ACTION_CLASS}>
        <Link to="/my-technologies">{action}</Link>
      </Button>
    </div>
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
      id="my-progress-readiness"
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
      <ProgressGroupLabel>Position</ProgressGroupLabel>
      {position ? (
        <ul>
          <ReadinessRow name={position.name} row={position} />
        </ul>
      ) : (
        <div className="px-[18px] py-3.5">
          <DeclarePrompt action="Declare one">
            You haven&apos;t declared a position yet. Declare one and your mentor can assess your
            readiness for it.
          </DeclarePrompt>
        </div>
      )}

      <ProgressGroupLabel>Technologies</ProgressGroupLabel>
      {technologies.length === 0 ? (
        <div className="px-[18px] py-3.5">
          <DeclarePrompt variant="outline" action="Add technologies">
            You haven&apos;t declared any technologies yet. Add the ones you are working toward —
            each one your mentor assesses shows up here.
          </DeclarePrompt>
        </div>
      ) : (
        /* Ready first, then learning, then unassessed — the order the server sorts
           them in, matching the admin's own grid so the two views of the same
           assessment read the same way. */
        <ul>
          {technologies.map((row) => (
            <ReadinessRow
              key={row.id}
              name={row.name}
              row={row}
              icon={<TechnologyIcon technology={row} size={17} className="shrink-0" />}
            />
          ))}
        </ul>
      )}

      {summary.none > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 border-t border-separator px-[18px] py-3 text-[11.5px] leading-[1.5] text-muted-foreground">
          {summary.none} of your {summary.total} technolog{summary.total === 1 ? 'y' : 'ies'}{' '}
          {summary.none === 1 ? 'has' : 'have'} not been assessed yet — worth raising at your next
          1-on-1.
          <Link
            to="/my-technologies"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Manage my technologies
            <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      )}
    </ProgressPanel>
  );
}
