import { differenceInCalendarDays, format } from 'date-fns';
import { CircleCheck, CircleDot, CircleSlash, Flag } from 'lucide-react';

import { CHIP, chipTone } from '@/helpers/badgeTones';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { getReadinessLabel } from '@/helpers/internProfile';
import { cn } from '@/lib/utils';

import { statusMeaning } from './programmeStatus';

/**
 * The one band that answers the question people open this page with: where do I
 * stand, and am I moving?
 *
 * It exists because that answer used to be spread across four sections and a
 * right-hand rail — the status inside a table of facts, readiness a section down,
 * the evaluation trend a chip inside a third. Everything below is now closed by
 * default, which only works if the summary above is honest enough to be read on
 * its own.
 *
 * Three deliberate calls:
 *
 * - **The meter is time, not attainment.** Nothing in the payload measures how far
 *   through the *programme* someone is; the calendar does, and pretending
 *   otherwise would be inventing a score. It is labelled as elapsed time and
 *   nothing else.
 * - **The tiles are numbers, not charts.** Three magnitudes with no shape to them;
 *   a plot would be decoration. The one thing that does move — the evaluation
 *   average — carries its delta as text beside it.
 * - **A tile opens its section.** That is what the deleted "On this page" rail was
 *   for, except a summary you can act on rather than a second list of anchors.
 */

/** Status → the app's reserved status tone. Everything else is neutral on purpose. */
const STATUS_TONE = {
  ready: { tone: 'success', Icon: CircleCheck },
  placed: { tone: 'success', Icon: Flag },
  discontinued: { tone: 'danger', Icon: CircleSlash },
};

const STATUS_FALLBACK = { tone: 'neutral', Icon: CircleDot };

/** Whole weeks elapsed, 1-based — "week 1" is the first week, not week zero. */
const weekOf = (days) => Math.floor(Math.max(days, 0) / 7) + 1;

function StatusChip({ status }) {
  if (!status) return null;
  const { tone, Icon } = STATUS_TONE[status] || STATUS_FALLBACK;
  return (
    <span className={cn(CHIP, 'gap-1.5 text-[11.5px] capitalize', chipTone(tone))}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      {status}
    </span>
  );
}

/**
 * Start → expected end, with today on it.
 *
 * Rendered only when both ends are known: half a timeline is a bar whose length
 * means nothing. A programme that has run past its expected end pins at 100 rather
 * than overflowing — the dates beside it already say what happened.
 */
function TimelineMeter({ startDate, expectedEndDate }) {
  if (!startDate || !expectedEndDate) return null;

  const start = new Date(startDate);
  const end = new Date(expectedEndDate);
  const total = differenceInCalendarDays(end, start);
  if (!Number.isFinite(total) || total <= 0) return null;

  const elapsed = differenceInCalendarDays(new Date(), start);
  const percent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  const weeks = Math.max(1, Math.ceil(total / 7));

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-1 w-full overflow-hidden rounded-[var(--r-pill)] bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Time elapsed in the programme"
      >
        {/* Neutral ink, not the accent. This is the least consequential fact in
            the band — a calendar, not an achievement — and at full width in the
            accent it was the first thing the eye landed on, ahead of the status it
            sits under. */}
        <div
          className="h-full rounded-[var(--r-pill)] bg-foreground/30 transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[11.5px] text-muted-foreground">
        <span className="tabular-nums">{format(start, 'MMM d, yyyy')}</span>
        <span className="font-medium text-foreground">
          {elapsed < 0
            ? 'Starts soon'
            : `Week ${weekOf(elapsed)} of ${weeks} · ${percent}% elapsed`}
        </span>
        <span className="tabular-nums">{format(end, 'MMM d, yyyy')}</span>
      </div>
    </div>
  );
}

/**
 * One summary number. A button, because every one of them has somewhere to go —
 * the section it summarises, opened in place.
 */
function StatTile({ label, value, hint, onOpen, dataTest }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-test={dataTest}
      className="ui-focus-ring flex min-w-0 flex-col gap-1 rounded-[var(--r-tile)] border border-separator bg-card px-3.5 py-3 text-left transition-colors hover:border-border hover:bg-accent/50"
    >
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75">
        {label}
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5">{value}</span>
      <span className="truncate text-[11.5px] text-muted-foreground">{hint}</span>
    </button>
  );
}

const HERO_NUMBER = 'text-[19px] font-semibold leading-none tracking-[-0.02em] tabular-nums';

export function ProgressHeader({ programme, readiness, evaluations, recommendations, onOpen }) {
  if (!programme) return null;

  const meaning = statusMeaning(programme.status);
  const position = programme.position?.name || '';
  const context = [position, programme.internshipType, programme.hub].filter(Boolean).join(' · ');

  const summary = readiness?.summary || { total: 0, ready: 0 };
  const positionLevel = readiness?.position?.level || null;
  const latestEvaluation = evaluations?.latest || null;
  const evaluationCount = evaluations?.total || 0;
  const delta = evaluations?.averageDelta ?? null;
  const latestRecommendation = recommendations?.items?.[0] || null;

  return (
    <section className="app-card flex flex-col gap-4 p-[18px]" data-test="my-progress-header">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={programme.status} />
            {context ? (
              <span className="min-w-0 truncate text-[12.5px] font-medium text-foreground">
                {context}
              </span>
            ) : null}
          </div>
          {meaning ? (
            <p className="mt-1.5 max-w-[46rem] text-[12.5px] leading-[1.5] text-muted-foreground">
              {meaning}
            </p>
          ) : null}
        </div>
        {programme.primaryMentor ? (
          <p className="shrink-0 text-[11.5px] text-muted-foreground">
            Mentored by{' '}
            <span className="font-medium text-foreground">{programme.primaryMentor}</span>
          </p>
        ) : null}
      </div>

      <TimelineMeter startDate={programme.startDate} expectedEndDate={programme.expectedEndDate} />

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile
          label="Readiness"
          dataTest="my-progress-stat-readiness"
          onOpen={() => onOpen('my-progress-readiness')}
          value={
            summary.total > 0 ? (
              <>
                <span className={cn(HERO_NUMBER, 'text-foreground')}>{summary.ready}</span>
                <span className="text-[12.5px] text-muted-foreground">
                  of {summary.total} ready
                </span>
              </>
            ) : (
              <span className="text-[13px] font-medium text-foreground">
                {positionLevel && positionLevel !== 'none'
                  ? getReadinessLabel(positionLevel)
                  : 'Nothing declared'}
              </span>
            )
          }
          hint={
            summary.total > 0
              ? 'Technologies your mentor has assessed'
              : 'Declare a position and technologies'
          }
        />

        <StatTile
          label="Evaluations"
          dataTest="my-progress-stat-evaluations"
          onOpen={() => onOpen('my-progress-evaluations')}
          value={
            latestEvaluation ? (
              <>
                <span className={cn(HERO_NUMBER, 'text-foreground')}>
                  {latestEvaluation.averageScore ?? '—'}
                </span>
                <span className="text-[12.5px] text-muted-foreground">/ 5 average</span>
                {typeof delta === 'number' && delta !== 0 ? (
                  <span
                    className={cn(
                      'text-[11.5px] font-semibold tabular-nums',
                      delta > 0
                        ? 'text-[hsl(var(--tone-success-fg))]'
                        : 'text-[hsl(var(--tone-danger-fg))]'
                    )}
                  >
                    {delta > 0 ? '+' : ''}
                    {delta}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-[13px] font-medium text-foreground">None yet</span>
            )
          }
          hint={
            evaluationCount > 0
              ? // The delta beside the number already says "since the last period";
                // repeating it here left the line ending on a dangling fragment.
                `Across ${evaluationCount} review ${evaluationCount === 1 ? 'period' : 'periods'}`
              : 'Written at the end of each review period'
          }
        />

        <StatTile
          label="Recommendations"
          dataTest="my-progress-stat-recommendations"
          onOpen={() => onOpen('my-progress-recommendations')}
          value={
            recommendations?.total > 0 ? (
              <>
                <span className={cn(HERO_NUMBER, 'text-foreground')}>{recommendations.total}</span>
                <span className="text-[12.5px] text-muted-foreground">
                  {recommendations.total === 1 ? 'project' : 'projects'}
                </span>
              </>
            ) : (
              <span className="text-[13px] font-medium text-foreground">None yet</span>
            )
          }
          hint={
            latestRecommendation
              ? // The stage first: an intern's question about a recommendation is
                // where it got to, not what it was called.
                [
                  capitalizeFirst(latestRecommendation.status || ''),
                  latestRecommendation.project || latestRecommendation.position,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Admins put you forward for projects'
          }
        />
      </div>
    </section>
  );
}

export default ProgressHeader;
