import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Bell, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardCard, DashboardCardHelp } from '@/components/dashboard/DashboardCard';
import { ExampleChip } from './ExampleChip';

// The recommendation lifecycle, in order. Mirrors RECOMMENDATION_STATUSES on the
// server; the labels are the intern-facing wording rather than the admin table's.
const STAGES = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'interviewing', label: 'Interview' },
  { key: 'resulted', label: 'Result' },
];

/** Chips past this fold into a "+N", so a long stack can't crowd out the timeline. */
const TECH_LIMIT = 4;

const RESULT_LABEL = {
  placed: 'Placed 🎉',
  not_placed: 'Not placed this time',
};

const formatDay = (value) => (value ? format(new Date(value), 'MMM d') : null);

/**
 * The state of each stage for this recommendation.
 *
 * Same rule as `buildTimelineSteps` in the admin recommendations UI — a stage
 * before the current one with no recorded date was skipped, not completed — but
 * kept separate rather than imported: that module carries the recommendations
 * redesign's own hardcoded palette and font stack, which would look foreign
 * dropped into a dashboard card.
 */
const buildSteps = (recommendation) => {
  const dates = recommendation.statusDates || {};
  const currentIndex = STAGES.findIndex((stage) => stage.key === recommendation.status);

  return STAGES.map((stage, index) => {
    let state;
    if (index === currentIndex) state = 'current';
    else if (index < currentIndex) state = dates[stage.key] ? 'done' : 'skipped';
    else state = 'pending';
    return { ...stage, state, date: formatDay(dates[stage.key]) };
  });
};

/**
 * The same three stages with nothing behind them, for an intern who has not been
 * put forward yet. Showing the row greyed out rather than hiding it is the point
 * of the empty state: it says what *will* happen, which the sentence alone can't.
 */
const EMPTY_STEPS = STAGES.map((stage) => ({ ...stage, state: 'pending', date: null }));

/**
 * The interview to put in front of the intern: the soonest one still ahead of them,
 * or failing that the latest one behind them.
 *
 * `upcoming` is returned rather than recomputed by the caller so the copy and the
 * choice can never disagree about which side of now a date falls on.
 */
const nextInterview = (interviews = []) => {
  const dated = (interviews || [])
    .filter((interview) => interview?.scheduledAt)
    .map((interview) => ({ ...interview, at: new Date(interview.scheduledAt).getTime() }))
    .filter((interview) => !Number.isNaN(interview.at));

  if (dated.length === 0) return null;

  const now = Date.now();
  const ahead = dated.filter((interview) => interview.at >= now);
  if (ahead.length > 0) {
    return { ...ahead.reduce((a, b) => (a.at <= b.at ? a : b)), upcoming: true };
  }
  return { ...dated.reduce((a, b) => (a.at >= b.at ? a : b)), upcoming: false };
};

/**
 * What the card says under each stage. Every line has to survive in a
 * third-of-a-card column, so each one carries the single most actionable fact for
 * its stage and nothing else — the interview's date and time, the outcome.
 */
const stepDetail = (step, recommendation) => {
  if (step.key === 'recommended') {
    // Bare date: the card header already names the project this was sent to, so
    // repeating it under the first stage says nothing new.
    return step.date || '—';
  }

  if (step.key === 'interviewing') {
    // The *soonest upcoming* one, not merely the first that carries a date. Stored
    // order is not chronological, so `find` would happily present last week's
    // interview as what is coming next — the opposite of actionable. With none
    // upcoming, fall back to the most recent past one and label it as past, so an
    // intern mid-process still sees where they got to.
    const next = nextInterview(recommendation.interviews);
    if (next) {
      // Date and time only. This sits in a third-of-a-card column now, and both
      // the weekday and the company name push it onto a third line — the company
      // being the more expendable of the two, since the header already names the
      // project this recommendation is for.
      const when = format(new Date(next.scheduledAt), 'MMM d · HH:mm');
      return next.upcoming ? when : `Interviewed ${when}`;
    }
    if (step.state === 'skipped') return 'Skipped';
    return step.date ? `Reached ${step.date}` : 'Not scheduled yet';
  }

  const outcome = recommendation.result?.outcome;
  if (outcome) {
    // Once they are placed, when they start is the only part of this the intern
    // can act on — it outranks the day the decision was recorded. Still unknown
    // is worth saying out loud rather than falling back to a date that isn't it.
    if (outcome === 'placed') {
      const starts = formatDay(recommendation.result.startDate);
      return starts
        ? `${RESULT_LABEL.placed} · starts ${starts}`
        : `${RESULT_LABEL.placed} · start date to be confirmed`;
    }
    const decided = formatDay(recommendation.result.decidedAt);
    return decided ? `${RESULT_LABEL[outcome]} · ${decided}` : RESULT_LABEL[outcome];
  }
  return step.state === 'pending' ? 'Decision pending' : 'Awaiting result';
};

function StepMarker({ step, index }) {
  const active = step.state === 'done' || step.state === 'current';
  const isCurrent = step.state === 'current';

  return (
    <span className="relative grid h-6 w-6 shrink-0 place-items-center">
      {/* The pulse marks where the intern is right now — it replaces the "Next
          step" chip that used to say the same thing in words. Absolutely
          positioned so the expanding ring never shifts the timeline, and behind
          the marker so the digit stays at full contrast. `motion-safe` keeps it
          out of the way of a reduced-motion preference; the static ring below is
          the resting state either way. */}
      {isCurrent && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping"
        />
      )}
      <span
        className={cn(
          'relative grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold',
          step.state === 'done' && 'bg-emerald-500 text-white',
          isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/15',
          !active && 'border border-dashed border-border bg-muted/40 text-muted-foreground'
        )}
      >
        {step.state === 'done' ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
      </span>
      {/* The pulse is the only "you are here" cue left now that the chip is gone,
          and a pulse says nothing to a screen reader. */}
      {isCurrent && <span className="sr-only">Current stage</span>}
    </span>
  );
}

/**
 * The three stages as one horizontal band.
 *
 * Horizontal because they are a short fixed sequence, and laid out this way they
 * cost one band instead of the whole card. The wrapper centres the band in
 * whatever height the grid row hands the card, so slack reads as breathing room
 * above and below rather than pooling into a dead block under the last stage.
 *
 * Shared with the empty state, which passes no `recommendation` — the stages then
 * render greyed out with no detail beneath them, showing what will happen rather
 * than leaving the card blank.
 */
function StageRow({ steps, recommendation = null }) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <ol className="grid grid-cols-3 py-5">
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex flex-col items-center px-1 text-center">
            {/* Connectors stop 1rem either side of the 1.5rem marker rather than
                running behind it, so a translucent pending marker doesn't show the
                line through its middle. `top-3` is the marker's centreline. */}
            {index > 0 && (
              <span
                aria-hidden="true"
                className="absolute left-0 right-[calc(50%+1rem)] top-3 h-px bg-border"
              />
            )}
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[calc(50%+1rem)] right-0 top-3 h-px bg-border"
              />
            )}
            <StepMarker step={step} index={index} />
            <p
              className={cn(
                'mt-2 text-xs font-semibold leading-4',
                step.state === 'pending' ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              {step.label}
            </p>
            {/* Each stage carries its own detail rather than a shared line below the
                stepper — the interview time and the placement outcome are the two
                things worth reading, and both belong under their own stage. */}
            {recommendation && (
              <p className="mt-0.5 text-balance text-[10px] leading-4 text-muted-foreground">
                {stepDetail(step, recommendation)}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Shared between the empty and populated card, so the "?" never disappears. */
function PipelineHelp() {
  return (
    <DashboardCardHelp label="About my selection process">
      <p>
        Your selection process is the recommendation your mentor put you forward with, and the
        stages it moves through: recommended → interview → result. The <strong>pulsing</strong>{' '}
        stage is where you are now.
      </p>
      <p>
        Only your mentor and the admins can move it along. The recommendation note and any interview
        feedback are not shown here.
      </p>
    </DashboardCardHelp>
  );
}

/**
 * "My Selection Process" — where the intern's current recommendation stands.
 *
 * The payload is redacted server-side (`recommendationService.listOwnRecommendations`):
 * stages, dates, project and outcome, but never the admin's recommendation note,
 * the interviewer's feedback, or the reasoning behind a placement decision.
 * Don't add fields to this card without checking what that formatter actually
 * sends — it picks fields explicitly, so anything new is absent, not undefined.
 */
export function MyPipelineCard({ pipeline, className, isPreview = false }) {
  // The whole list, so an intern put forward for more than one project can move
  // between them. Falls back to `[current]` for a payload that predates `items`.
  const items = useMemo(() => {
    if (pipeline?.items?.length) return pipeline.items;
    return pipeline?.current ? [pipeline.current] : [];
  }, [pipeline]);

  const [index, setIndex] = useState(0);
  // A recommendation resolving reorders the list (sorted by `updatedAt`), which can
  // leave the index past the end — clamp rather than render undefined.
  const safeIndex = Math.min(index, Math.max(0, items.length - 1));
  const recommendation = items[safeIndex] || null;
  const many = items.length > 1;

  if (!recommendation) {
    return (
      <DashboardCard
        id="my-selection-process"
        className={className}
        title="My Selection Process"
        action={<PipelineHelp />}
        data-tour="intern-dashboard-pipeline"
      >
        {/* Same band as the populated card, greyed out — an intern who has never
            been recommended learns the three stages here rather than meeting them
            for the first time on the day something moves. */}
        <StageRow steps={EMPTY_STEPS} />
        <p className="mt-3 border-t border-border pt-3 text-[11px] leading-4 text-muted-foreground">
          No recommendation yet. When your mentor puts you forward for a project, its progress shows
          up here.
        </p>
      </DashboardCard>
    );
  }

  const steps = buildSteps(recommendation);

  return (
    <DashboardCard
      id="my-selection-process"
      className={className}
      title="My Selection Process"
      action={
        <div className="flex shrink-0 items-center gap-1.5">
          {isPreview && <ExampleChip />}
          {/* Only when there is somewhere to go. The position/project line under the
              title is what names the record being shown, so the control itself stays
              a bare position indicator rather than repeating them. */}
          {many && (
            <span className="flex items-center gap-0.5" data-test="pipeline-switcher">
              <button
                type="button"
                onClick={() => setIndex(safeIndex === 0 ? items.length - 1 : safeIndex - 1)}
                aria-label="Previous recommendation"
                className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span
                className="min-w-[2.25rem] text-center text-[10px] font-semibold tabular-nums text-muted-foreground"
                aria-live="polite"
              >
                {safeIndex + 1} / {items.length}
              </span>
              <button
                type="button"
                onClick={() => setIndex(safeIndex === items.length - 1 ? 0 : safeIndex + 1)}
                aria-label="Next recommendation"
                className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </span>
          )}
          <PipelineHelp />
        </div>
      }
      data-tour="intern-dashboard-pipeline"
    >
      {/* Names the record the switcher above is paging through, so the timeline
          below never has to repeat it. Position and project are independent
          fields on the recommendation — either can be absent on its own. */}
      {(recommendation.position || recommendation.project) && (
        <p className="-mt-1 truncate text-xs leading-4 text-muted-foreground">
          {[recommendation.position, recommendation.project].filter(Boolean).join(' · ')}
        </p>
      )}
      {/* What the intern was put forward *for*, in their own terms — the one piece
          of the payload that is about the match rather than its progress. Capped
          so a long stack can't push the timeline out of the card. */}
      {recommendation.technologies?.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {recommendation.technologies.slice(0, TECH_LIMIT).map((tech) => (
            <li
              key={tech.id || tech.name}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium leading-4 text-muted-foreground"
            >
              {tech.name}
            </li>
          ))}
          {recommendation.technologies.length > TECH_LIMIT && (
            <li className="px-1 py-0.5 text-[10px] leading-4 text-muted-foreground">
              +{recommendation.technologies.length - TECH_LIMIT}
            </li>
          )}
        </ul>
      )}
      <StageRow steps={steps} recommendation={recommendation} />
      {/* Sets expectation once instead of per-stage: the intern has nothing to do
          here, so the card should say so rather than imply they need to check back. */}
      <p className="mt-3 flex items-start gap-2 border-t border-border pt-3 text-[11px] leading-4 text-muted-foreground">
        <Bell className="mt-px h-3.5 w-3.5 shrink-0" />
        We&apos;ll notify you when this moves — nothing needed from you.
      </p>
    </DashboardCard>
  );
}
