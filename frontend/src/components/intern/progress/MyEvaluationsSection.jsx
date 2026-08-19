import { format } from 'date-fns';
import { EVALUATION_CRITERIA } from '@/helpers/internProfile';
import { Badge } from '@/components/ui/badge';
import {
  ProgressGroupLabel,
  ProgressPanel,
  ProgressPanelEmpty,
  ProgressPanelLead,
} from './ProgressPanel';
import { ScoreDelta, ScoreScale } from './ScoreScale';

const formatPeriod = (evaluation) =>
  `${format(new Date(evaluation.periodStart), 'MMM d, yyyy')} – ${format(
    new Date(evaluation.periodEnd),
    'MMM d, yyyy'
  )}`;

/**
 * One review period: the four criterion scores, the average, and the mentor's
 * write-up.
 *
 * The newest period is the only one that carries movement chips, and it gets them
 * from the server's `trends` rather than diffing here — the payload compares
 * exactly the two newest periods, which is the comparison the chip claims to be.
 * Older periods deliberately show no chips: "+1 since the period before" for a
 * review from a year ago is arithmetic nobody asked for.
 */
/**
 * An earlier review period, on one line: when, who wrote it, and the average.
 *
 * Only the newest period renders its four scales and write-up. Six periods of
 * full-height scores is a page nobody scrolls to the end of, and an older
 * evaluation is looked *up* — "what did I get in the spring?" — rather than read.
 * The scores behind this line are one click away in the same place they have
 * always been: the mentor who wrote it.
 */
function EarlierPeriod({ evaluation }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-separator px-[18px] py-2.5 last:border-b-0">
      <span className="min-w-0 text-[12.5px] font-medium text-foreground">
        {formatPeriod(evaluation)}
      </span>
      <span className="flex items-baseline gap-3">
        <span className="text-[11.5px] text-muted-foreground">
          {evaluation.evaluator || 'your mentor'}
        </span>
        <span className="text-[12.5px] font-semibold tabular-nums text-foreground">
          {evaluation.averageScore ?? '—'}
          <span className="ml-1 text-[11px] font-medium text-muted-foreground">/ 5</span>
        </span>
      </span>
    </li>
  );
}

/** The band's summary: what is in this section, in one muted phrase. */
function SectionCount({ children }) {
  return <span className="text-[11.5px] font-medium text-muted-foreground">{children}</span>;
}

function EvaluationPeriod({ evaluation, trends, isLatest }) {
  const deltaByCriterion = Object.fromEntries(
    (trends || []).map((trend) => [trend.key, trend.delta])
  );

  return (
    <li className="p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          {/* A div, not a p: `Badge` renders a div, and a block element inside a
              paragraph is invalid HTML that React reports at runtime. */}
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {formatPeriod(evaluation)}
            {isLatest && (
              <Badge variant="outline" className="font-semibold">
                Latest
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reviewed by {evaluation.evaluator || 'your mentor'}
          </p>
        </div>

        <p className="flex items-baseline gap-1.5">
          <span className="text-xl font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">
            {evaluation.averageScore ?? '—'}
          </span>
          <span className="text-[11.5px] font-medium text-muted-foreground">/ 5 average</span>
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {EVALUATION_CRITERIA.map((criterion) => (
          <ScoreScale
            key={criterion.key}
            label={criterion.label}
            score={evaluation.scores?.[criterion.key]}
            delta={isLatest ? (deltaByCriterion[criterion.key] ?? null) : null}
          />
        ))}
      </div>

      {/* The mentor's write-up. Plain text through a React text node — never an HTML
          sink — so `whitespace-pre-line` is what preserves the paragraphs they typed.
          An evaluation with no notes says so rather than leaving a gap that reads as
          a loading failure. */}
      <div className="mt-4 rounded-[var(--r-card)] bg-muted/40 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Mentor&apos;s notes
        </p>
        {evaluation.notes ? (
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-foreground">
            {evaluation.notes}
          </p>
        ) : (
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            No written notes for this period.
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * "Evaluations" — every review period recorded about the intern, newest first.
 *
 * Read-only: evaluations are authored by admins only
 * (`evaluationService.createEvaluation`), and this page has no write path to them.
 *
 * The written notes ARE shown here, unlike on the dashboard card, which shows only
 * scores. A score with no explanation is not feedback anyone can act on — see the
 * comment on `formatOwnEvaluation` server-side for the reasoning and for what stays
 * withheld.
 */
export function MyEvaluationsSection({ evaluations }) {
  const items = evaluations?.items || [];
  const averageDelta = evaluations?.averageDelta ?? null;

  return (
    <ProgressPanel
      id="my-progress-evaluations"
      title="Evaluations"
      action={
        items.length === 0 ? (
          <SectionCount>None yet</SectionCount>
        ) : (
          <span className="flex items-center gap-2">
            <SectionCount>
              {items.length} review {items.length === 1 ? 'period' : 'periods'}
            </SectionCount>
            {items.length > 1 ? <ScoreDelta delta={averageDelta} /> : null}
          </span>
        )
      }
      dataTour="my-progress-evaluations"
    >
      <ProgressPanelLead>
        Every review period your mentor has recorded, with the four scores and the notes behind
        them.
      </ProgressPanelLead>

      {items.length === 0 ? (
        // The four criteria as chips: what the section will be made of, which is
        // more use to an intern than a longer sentence about its absence.
        <ProgressPanelEmpty fields={EVALUATION_CRITERIA.map((criterion) => criterion.label)}>
          No evaluation recorded yet. Your mentor writes one at the end of each review period.
        </ProgressPanelEmpty>
      ) : (
        <>
          <ul>
            {items.slice(0, 1).map((evaluation) => (
              <EvaluationPeriod
                key={evaluation.id}
                evaluation={evaluation}
                trends={evaluations?.trends}
                isLatest
              />
            ))}
          </ul>

          {items.length > 1 && (
            <>
              <ProgressGroupLabel>Earlier periods</ProgressGroupLabel>
              <ul>
                {items.slice(1).map((evaluation) => (
                  <EarlierPeriod key={evaluation.id} evaluation={evaluation} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </ProgressPanel>
  );
}
