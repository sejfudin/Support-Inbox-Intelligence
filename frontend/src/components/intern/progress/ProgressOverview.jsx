import { Link } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import {
  CalendarCheck,
  CircleCheck,
  CircleDot,
  CircleSlash,
  Code2,
  Eye,
  Flag,
  Lock,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CHIP, chipTone } from '@/helpers/badgeTones';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { formatDate } from '@/helpers/date';
import { getReadinessLabel, isAssessedLevel } from '@/helpers/internProfile';
import { cn } from '@/lib/utils';
import { ProgressGroupLabel } from './ProgressPanel';
import { statusMeaning } from './programmeStatus';

/**
 * "Where you stand" — one card, always open, that answers everything an intern
 * used to have to open two separate things to see: the status/timeline/stat-tile
 * summary that used to be its own header band, and the programme's own record of
 * dates, position, mentors and hub that used to be a closed-by-default "Programme
 * details" dropdown underneath it.
 *
 * Merged deliberately, not just placed next to each other: both halves are facts
 * *about* the intern's record rather than something that happened (an evaluation,
 * a recommendation) or something someone wrote (a mentor note) — the same
 * distinction that keeps this card out of the tabs and out of the accordion
 * below it. `primaryMentor` is stated once, in the hero line, rather than a
 * second time as a fact row now that both are always visible together.
 *
 * The tiles still open something, they just don't all open it in the same place
 * any more: readiness stays on this tab (the accordion right below), so its tile
 * still opens-and-scrolls in place; evaluations and recommendations moved out to
 * their own tabs, so those two tiles switch tabs instead.
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
 * readiness opens in place below; evaluations/recommendations switch to their tab.
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

/**
 * A date for a fact, or `null` so the row's own fallback handles the empty case.
 *
 * Not `formatDate` directly: the shared helper returns a hyphen for a missing date
 * while a fact row falls back to an em dash, which put two different "no value"
 * glyphs in the same grid — "—" under Position and "-" under Expected end.
 */
const factDate = (value) => (value ? formatDate(value) : null);

/** One label/value row in the programme-details grid. Falls back to an em dash so the grid never has holes. */
function Fact({ label, value, hint }) {
  return (
    <div className="border-b border-separator py-[13px]">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="shrink-0 text-[12.5px] leading-[1.45] text-muted-foreground">{label}</dt>
        <dd className="min-w-0 text-right text-[12.5px] font-medium leading-[1.45] text-foreground">
          {value || '—'}
        </dd>
      </div>
      {hint ? (
        <p className="mt-1 text-[11.5px] leading-[1.5] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const ACTION_CLASS = 'h-[34px] rounded-[var(--r-control)] px-3.5 text-[12.5px]';

export function ProgressOverview({
  programme,
  readiness,
  evaluations,
  recommendations,
  onOpenReadiness,
  onGoToEvaluations,
  onGoToRecommendations,
}) {
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

  const specialization = programme.specialization;

  /* Built as a list rather than written out as markup because the grid below flows
     by COLUMN, and column flow needs to know how many rows to break at. Which facts
     exist varies — a specialization adds its mentor, a placement adds its first day
     — so the row count is derived from the list instead of hardcoded.
     Primary mentor is deliberately not repeated here — it's already the hero
     line's "Mentored by …", and both halves of this card are visible together now. */
  const facts = [
    {
      label: 'Programme',
      value: programme.internshipType,
    },
    {
      label: 'Started',
      value: factDate(programme.startDate),
    },
    {
      label: 'Position',
      value: programme.position ? (
        // A div, not a span: `Badge` renders a div, which is invalid inside inline
        // content. `dd` is a block container, so this nests fine.
        <div className="flex flex-wrap items-center justify-end gap-2">
          {programme.position.name}
          {specialization ? (
            <Badge variant="secondary" className="gap-1 rounded-full px-2 py-0 text-[10.5px]">
              <Lock className="h-3 w-3" />
              Specialization
            </Badge>
          ) : null}
        </div>
      ) : null,
      hint: specialization
        ? `Confirmed as your focus on ${formatDate(specialization.assignedAt)} — you can't change this one yourself.`
        : undefined,
    },
    {
      label: 'Secondary position',
      value: programme.secondaryPosition?.name,
    },
    // Only meaningful when a specialization exists: `secondaryMentor` is the
    // specialization mentor and nothing else since ADR-0002, so labelling it
    // "secondary mentor" would name a relationship that no longer exists.
    specialization && {
      label: 'Specialization mentor',
      value: specialization.mentor,
    },
    {
      label: 'Hub',
      value: programme.hub,
    },
    {
      label: 'Expected end',
      value: factDate(programme.expectedEndDate),
    },
    // Routinely a future date — it is set as soon as a start date is known — so
    // this is printed as a fact and draws no "you are on a project now" conclusion
    // from it.
    programme.placedAt && {
      label: 'First day on project',
      value: factDate(programme.placedAt),
      hint: 'Office attendance is not recorded from this day on.',
    },
  ].filter(Boolean);

  const rows = Math.ceil(facts.length / 2);

  return (
    <section className="app-card flex flex-col overflow-hidden" data-test="my-progress-overview">
      <div className="flex flex-col gap-4 p-[18px]">
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

        <TimelineMeter
          startDate={programme.startDate}
          expectedEndDate={programme.expectedEndDate}
        />

        <div className="grid gap-2.5 sm:grid-cols-3">
          <StatTile
            label="Readiness"
            dataTest="my-progress-stat-readiness"
            onOpen={onOpenReadiness}
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
                  {isAssessedLevel(positionLevel)
                    ? getReadinessLabel(positionLevel)
                    : 'Nothing declared'}
                </span>
              )
            }
            hint={
              summary.total > 0
                ? 'Skills your mentor has assessed'
                : 'Declare a position and skills'
            }
          />

          <StatTile
            label="Evaluations"
            dataTest="my-progress-stat-evaluations"
            onOpen={onGoToEvaluations}
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
            onOpen={onGoToRecommendations}
            value={
              recommendations?.total > 0 ? (
                <>
                  <span className={cn(HERO_NUMBER, 'text-foreground')}>
                    {recommendations.total}
                  </span>
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
      </div>

      <ProgressGroupLabel className="flex items-center justify-between gap-3">
        <span>Programme details</span>
        {/* The read-only note reads as state, not as a control, so it sits beside
            the label as plain muted text rather than a badge. */}
        <span className="inline-flex items-center gap-1.5 font-normal normal-case tracking-normal text-muted-foreground/75">
          <Eye className="h-3.5 w-3.5" />
          Read-only
        </span>
      </ProgressGroupLabel>

      <div className="p-[18px] pt-[15px]">
        {/* Column flow, not row flow: read down one column and then down the next,
            so the facts the programme has actually recorded stay together instead of
            alternating with a column of em dashes across every row. */}
        <dl
          className="grid gap-x-9 sm:auto-cols-fr sm:grid-flow-col"
          style={{ gridTemplateRows: `repeat(${rows}, auto)` }}
        >
          {facts.map((fact) => (
            <Fact key={fact.label} label={fact.label} value={fact.value} hint={fact.hint} />
          ))}
        </dl>

        {/* The two pages the intern can actually change something on — the only
            way off this otherwise read-only page. */}
        <div className="mt-[18px] flex flex-wrap gap-2">
          <Button asChild variant="outline" className={ACTION_CLASS}>
            <Link to="/my-attendance">
              <CalendarCheck />
              My attendance
            </Link>
          </Button>
          <Button asChild variant="outline" className={ACTION_CLASS}>
            <Link to="/my-technologies">
              <Code2 />
              Position &amp; skills
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default ProgressOverview;
