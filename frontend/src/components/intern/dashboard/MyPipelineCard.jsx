import { format } from 'date-fns';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DashboardCard,
  DashboardCardEmpty,
  DashboardCardHelp,
} from '@/components/dashboard/DashboardCard';
import { ExampleChip } from './ExampleChip';

// The recommendation lifecycle, in order. Mirrors RECOMMENDATION_STATUSES on the
// server; the labels are the intern-facing wording rather than the admin table's.
const STAGES = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'interviewing', label: 'Interview' },
  { key: 'resulted', label: 'Result' },
];

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
 * What the card says under each stage. The interview line names the company and
 * time when one is scheduled, because that is the single most actionable thing
 * on this card for the intern.
 */
const stepDetail = (step, recommendation) => {
  if (step.key === 'recommended') {
    return step.date ? `Recommended ${step.date}` : null;
  }

  if (step.key === 'interviewing') {
    const next = (recommendation.interviews || []).find((interview) => interview.scheduledAt);
    if (next) {
      return `${format(new Date(next.scheduledAt), 'EEE MMM d · HH:mm')} with ${next.company}`;
    }
    if (step.state === 'skipped') return 'Skipped';
    return step.date ? `Reached ${step.date}` : 'Not scheduled yet';
  }

  const outcome = recommendation.result?.outcome;
  if (outcome) {
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

/** Shared between the empty and populated card, so the "?" never disappears. */
function PipelineHelp() {
  return (
    <DashboardCardHelp label="About my pipeline">
      <p>
        Your pipeline is the recommendation your mentor put you forward with, and the stages it
        moves through: recommended → interview → result. The <strong>pulsing</strong> stage is where
        you are now.
      </p>
      <p>
        Only your mentor and the admins can move it along. The recommendation note and any interview
        feedback are not shown here.
      </p>
    </DashboardCardHelp>
  );
}

/**
 * "My pipeline" — where the intern's current recommendation stands.
 *
 * The payload is redacted server-side (`recommendationService.listOwnRecommendations`):
 * stages, dates, project and outcome, but never the admin's recommendation note,
 * the interviewer's feedback, or the reasoning behind a placement decision.
 * Don't add fields to this card without checking what that formatter actually
 * sends — it picks fields explicitly, so anything new is absent, not undefined.
 */
export function MyPipelineCard({ pipeline, className, isPreview = false }) {
  const recommendation = pipeline?.current;

  if (!recommendation) {
    return (
      <DashboardCard
        className={className}
        title="My pipeline"
        action={<PipelineHelp />}
        data-tour="intern-dashboard-pipeline"
      >
        <DashboardCardEmpty>
          No recommendation yet. When your mentor puts you forward for a project, its progress shows
          up here.
        </DashboardCardEmpty>
      </DashboardCard>
    );
  }

  const steps = buildSteps(recommendation);

  return (
    <DashboardCard
      className={className}
      title="My pipeline"
      action={
        <div className="flex shrink-0 items-center gap-1.5">
          {isPreview && <ExampleChip />}
          {recommendation.project && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
              {recommendation.project}
            </span>
          )}
          <PipelineHelp />
        </div>
      }
      data-tour="intern-dashboard-pipeline"
    >
      {/* The timeline fills the card instead of bunching into the first third.
          Every step but the last grows, so the connectors stretch with the card
          and stay continuous — hence no gap on the list itself; the spacing comes
          from each step's own bottom padding. */}
      <ol className="flex flex-1 flex-col">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={cn('flex gap-3', index < steps.length - 1 && 'min-h-[3.25rem] flex-1')}
          >
            <div className="flex flex-col items-center">
              <StepMarker step={step} index={index} />
              {/* Connector, drawn on every step but the last. */}
              {index < steps.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <p
                className={cn(
                  'text-sm font-semibold leading-5',
                  step.state === 'pending' ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                {stepDetail(step, recommendation)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </DashboardCard>
  );
}
