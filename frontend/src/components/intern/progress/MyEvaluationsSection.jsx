import { format } from 'date-fns';
import { EVALUATION_CRITERIA } from '@/helpers/internProfile';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ProgressPanel, ProgressPanelEmpty, ProgressPanelLead } from './ProgressPanel';
import { ScoreDelta, ScoreScale } from './ScoreScale';

const formatPeriod = (evaluation) =>
  `${format(new Date(evaluation.periodStart), 'MMM d, yyyy')} – ${format(
    new Date(evaluation.periodEnd),
    'MMM d, yyyy'
  )}`;

/** The band's summary: what is in this section, in one muted phrase. */
function SectionCount({ children }) {
  return <span className="text-[11.5px] font-medium text-muted-foreground">{children}</span>;
}

/**
 * One review period, collapsed to a line — when, who, the average — until
 * clicked. Expanding it reveals the four criterion scores and the mentor's
 * write-up, the same detail every period carries; only the newest starts open
 * (see `MyEvaluationsSection`'s `defaultValue`). Every earlier one used to be a
 * dead-end line with no way to see what it actually said — this is the same row,
 * now a trigger for its own content instead of a summary with nothing behind it.
 *
 * Movement chips are shown only on the newest period's scores, and only because
 * they come from the server's `trends`, which compares exactly the two newest
 * periods — "+1 since the period before" on a review from a year ago is
 * arithmetic nobody asked for.
 */
function EvaluationRow({ evaluation, trends, isLatest }) {
  const deltaByCriterion = Object.fromEntries(
    (trends || []).map((trend) => [trend.key, trend.delta])
  );

  return (
    <AccordionItem value={evaluation.id} className="border-b-0">
      <AccordionTrigger className="gap-x-4 px-[18px] py-3 text-left font-normal transition-colors hover:bg-muted/30">
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-foreground">
            {formatPeriod(evaluation)}
            {isLatest && (
              <Badge as="span" variant="outline" className="font-semibold">
                Latest
              </Badge>
            )}
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
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-[18px] pb-[18px]">
        <div className="space-y-2">
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
      </AccordionContent>
    </AccordionItem>
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
export function MyEvaluationsSection({ evaluations, collapsible = true }) {
  const items = evaluations?.items || [];
  const averageDelta = evaluations?.averageDelta ?? null;

  return (
    <ProgressPanel
      id="my-progress-evaluations"
      title="Evaluations"
      collapsible={collapsible}
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
        Every review period your mentor has recorded. The newest is open below — click any other
        period to see its scores and notes.
      </ProgressPanelLead>

      {items.length === 0 ? (
        // The four criteria as chips: what the section will be made of, which is
        // more use to an intern than a longer sentence about its absence.
        <ProgressPanelEmpty fields={EVALUATION_CRITERIA.map((criterion) => criterion.label)}>
          No evaluation recorded yet. Your mentor writes one at the end of each review period.
        </ProgressPanelEmpty>
      ) : (
        <Accordion
          type="single"
          collapsible
          defaultValue={items[0]?.id}
          className="divide-y divide-separator"
        >
          {items.map((evaluation, index) => (
            <EvaluationRow
              key={evaluation.id}
              evaluation={evaluation}
              trends={evaluations?.trends}
              isLatest={index === 0}
            />
          ))}
        </Accordion>
      )}
    </ProgressPanel>
  );
}
