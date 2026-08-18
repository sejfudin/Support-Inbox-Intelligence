import { format } from 'date-fns';
import { Bell, Building2, Check, CalendarClock, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/helpers/date';
import { buildStageSteps, outcomeLabel, sortInterviews } from '@/helpers/recommendationStages';
import { ProgressPanel, ProgressPanelEmpty, ProgressPanelLead } from './ProgressPanel';

/** The fields a recommendation is made of — the empty state's chips. */
const RECOMMENDATION_FIELDS = ['Position', 'Technologies', 'Stage', 'Date'];

const STAGE_HINT = {
  recommended: 'An admin put you forward for this project.',
  interviewing: 'Interviews are being arranged or have taken place.',
  resulted: 'The placement decision has been recorded.',
};

const STATUS_BADGE_VARIANT = {
  recommended: 'secondary',
  interviewing: 'warning',
  resulted: 'outline',
};

const formatDateTime = (value) => format(new Date(value), 'MMM d, yyyy · HH:mm');

/**
 * The three stages as a vertical list, one row per stage with its recorded date.
 *
 * Vertical, unlike the dashboard card's horizontal band: this page has the width to
 * spend on the date *and* what the stage means, and this is the surface where "all
 * the associated dates" is the point rather than a one-line status.
 */
function StageList({ recommendation }) {
  const steps = buildStageSteps(recommendation);

  return (
    <ol className="mt-4 space-y-2.5">
      {steps.map((step, index) => {
        const isDone = step.state === 'done';
        const isCurrent = step.state === 'current';
        const isSkipped = step.state === 'skipped';

        return (
          <li key={step.key} className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                isDone && 'bg-[hsl(var(--tone-success))] text-white',
                isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/15',
                !isDone &&
                  !isCurrent &&
                  'border border-dashed border-border bg-muted/40 text-muted-foreground'
              )}
            >
              {isDone ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : isSkipped ? (
                <Minus className="h-3 w-3" strokeWidth={3} />
              ) : (
                index + 1
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                {step.label}
                {isCurrent && (
                  <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    You are here
                  </span>
                )}
                {/* "Skipped" and "Pending" are different facts and must not both read
                    as a blank date: interviewing is legitimately skippable, and a
                    stage that was never reached has not been skipped. */}
                {isSkipped && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Skipped
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {step.date
                  ? `${step.date} · ${STAGE_HINT[step.key]}`
                  : isSkipped
                    ? 'No interview stage was recorded for this recommendation.'
                    : // The stage they are ON, with no date recorded — legacy records
                      // whose history fallback has no entry for the current status.
                      // Without this branch it fell through to the pending copy and
                      // printed "You are here" and "Not reached yet." on one row.
                      isCurrent
                      ? STAGE_HINT[step.key]
                      : 'Not reached yet.'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Every interview scheduled on this recommendation, soonest first.
 *
 * Company, role, stage and when — never `interviews[].feedback`, which the server's
 * `formatOwnRecommendation` withholds and this component therefore never receives.
 */
function InterviewList({ interviews }) {
  const sorted = sortInterviews(interviews);
  if (sorted.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Interviews
      </h4>
      <ul className="mt-2 space-y-1.5">
        {sorted.map((interview, index) => (
          <li
            key={`${interview.company}-${interview.scheduledAt || index}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-5"
          >
            <CalendarClock className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground" />
            <span className="font-medium text-foreground">
              {[interview.company, interview.role].filter(Boolean).join(' · ')}
            </span>
            {interview.stage ? (
              <span className="text-muted-foreground">({interview.stage})</span>
            ) : null}
            <span className="text-muted-foreground">
              {interview.scheduledAt ? formatDateTime(interview.scheduledAt) : 'Not scheduled yet'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The recorded outcome: placed or not, when it was decided, and — when placed — the
 * first day on the project.
 *
 * The start date is optional by design and often unknown when the placement is
 * recorded, so "to be confirmed" is said out loud rather than papered over with the
 * decision date. It is also the date that ends the intern's attendance obligation,
 * which is why it is worth its own line here.
 *
 * The label goes through `outcomeLabel`, shared with the dashboard card: a
 * `not_placed` whose demand ended underneath it is not a rejection, and labelling it
 * "Not placed this time" would tell the intern they were turned down for something
 * nobody ever decided. Its badge stays neutral for the same reason — the red
 * `destructive` tone is for a decision that actually went against them.
 */
function OutcomeBlock({ result }) {
  const outcome = result?.outcome;
  if (!outcome) return null;

  const placed = outcome === 'placed';
  const demandEnded = Boolean(result.demandEnded);

  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={placed ? 'success' : demandEnded ? 'secondary' : 'destructive'}>
          {outcomeLabel(result)}
        </Badge>
        {result.decidedAt ? (
          <span className="text-xs text-muted-foreground">
            Decided {formatDate(result.decidedAt)}
          </span>
        ) : null}
      </div>
      {placed && (
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          {result.startDate
            ? `First day on the project: ${formatDate(result.startDate)}. From that day you no longer record office attendance.`
            : 'Your start date has not been confirmed yet — until it is, keep recording office attendance as normal.'}
        </p>
      )}
    </div>
  );
}

function RecommendationCard({ recommendation, isLatest }) {
  const technologies = recommendation.technologies || [];

  return (
    <li className="p-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {/* A div, not a p: `Badge` renders a div, and a block element inside a
              paragraph is invalid HTML that React reports at runtime. */}
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            {/* Position and project are independent fields — either can be absent on
                its own, so neither may stand in for the other. */}
            {[recommendation.position, recommendation.project].filter(Boolean).join(' · ') ||
              'Project to be confirmed'}
            {isLatest && (
              <Badge variant="outline" className="font-semibold">
                Most recent
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last updated {formatDate(recommendation.updatedAt)}
          </p>
        </div>

        <Badge variant={STATUS_BADGE_VARIANT[recommendation.status] || 'secondary'}>
          {recommendation.status === 'resulted'
            ? 'Result recorded'
            : recommendation.status === 'interviewing'
              ? 'Interviewing'
              : 'Recommended'}
        </Badge>
      </div>

      {technologies.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {technologies.map((tech) => (
            <li
              key={tech.id || tech.name}
              className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium leading-5 text-muted-foreground"
            >
              {tech.name}
            </li>
          ))}
        </ul>
      )}

      <StageList recommendation={recommendation} />
      <InterviewList interviews={recommendation.interviews} />
      <OutcomeBlock result={recommendation.result} />
    </li>
  );
}

/**
 * "Recommendations" — every project the intern has been put forward for, with the
 * stage it reached and every date along the way.
 *
 * Read-only: recommendations are created, advanced and resolved by admins only
 * (`requireRole(ADMIN)` on `/api/recommendations`). The payload is redacted
 * server-side by `formatOwnRecommendation` — the admin's recommendation note, the
 * interviewer's feedback and the reasoning behind the decision are not part of it,
 * so nothing in this component can render them by accident.
 */
export function MyRecommendationsSection({ recommendations }) {
  const items = recommendations?.items || [];

  return (
    <ProgressPanel
      id="my-progress-recommendations"
      title="Recommendations"
      action={
        items.length === 0 ? (
          <Badge variant="outline" className="rounded-full font-medium text-muted-foreground">
            None yet
          </Badge>
        ) : items.length > 1 ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            {items.length} recommendations
          </span>
        ) : null
      }
      dataTour="my-progress-recommendations"
    >
      <ProgressPanelLead>
        Projects you have been put forward for — the position, the technologies, which stage it
        reached, and when.
      </ProgressPanelLead>

      {items.length === 0 ? (
        <ProgressPanelEmpty fields={RECOMMENDATION_FIELDS}>
          You haven&apos;t been recommended for a project yet. When an admin puts you forward, every
          date shows up here.
        </ProgressPanelEmpty>
      ) : (
        <>
          <ul className="divide-y divide-separator">
            {items.map((recommendation, index) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                isLatest={index === 0}
              />
            ))}
          </ul>
          {/* Says once what would otherwise be implied per stage: there is nothing
              for the intern to do on this page. */}
          <p className="flex items-start gap-2 border-t border-separator px-[18px] py-3.5 text-[11.5px] leading-[1.5] text-muted-foreground">
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Only admins can move a recommendation along — nothing here needs anything from you.
          </p>
        </>
      )}
    </ProgressPanel>
  );
}
