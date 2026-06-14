import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { FunnelRow } from '@/components/symphony/dashboard/FunnelRow';
import { getRecommendationResultLabel } from '@/helpers/recommendations';

export function RecommendationFunnelCard({
  isPending,
  recommendationFunnel = {},
  recommendationOutcomes = {},
}) {
  const pipelineTotal =
    (recommendationFunnel.recommended || 0) +
    (recommendationFunnel.interviewing || 0) +
    (recommendationFunnel.resulted || 0);

  const outcomesTotal =
    (recommendationOutcomes.placed || 0) + (recommendationOutcomes.not_placed || 0);

  return (
    <SymphonyCard>
      <h2 className="text-lg font-semibold">Recommendation pipeline</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Placement attempts by stage and recent outcomes.
      </p>

      <div className="mt-4 space-y-3">
        {isPending && <p className="text-sm text-muted-foreground">Loading pipeline...</p>}
        {!isPending && (
          <>
            <FunnelRow
              label="Recommended"
              count={recommendationFunnel.recommended || 0}
              total={pipelineTotal || 1}
            />
            <FunnelRow
              label="Interviewing"
              count={recommendationFunnel.interviewing || 0}
              total={pipelineTotal || 1}
            />
            <FunnelRow
              label="Resulted"
              count={recommendationFunnel.resulted || 0}
              total={pipelineTotal || 1}
            />
          </>
        )}
      </div>

      {!isPending && outcomesTotal > 0 && (
        <div className="mt-6 space-y-3 border-t border-border/60 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Outcomes
          </p>
          <FunnelRow
            label={getRecommendationResultLabel('placed')}
            count={recommendationOutcomes.placed || 0}
            total={outcomesTotal}
          />
          <FunnelRow
            label={getRecommendationResultLabel('not_placed')}
            count={recommendationOutcomes.not_placed || 0}
            total={outcomesTotal}
          />
        </div>
      )}
    </SymphonyCard>
  );
}
