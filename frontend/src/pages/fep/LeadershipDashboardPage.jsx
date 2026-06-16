import { useMemo } from 'react';
import { format } from 'date-fns';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { ActivePipelineTable } from '@/components/symphony/dashboard/ActivePipelineTable';
import { DashboardKpiBand } from '@/components/symphony/dashboard/DashboardKpiBand';
import { DashboardUrgencyStrip } from '@/components/symphony/dashboard/DashboardUrgencyStrip';
import { PlacementBenchTable } from '@/components/symphony/dashboard/PlacementBenchTable';
import { ProgrammeBreakdown } from '@/components/symphony/dashboard/ProgrammeBreakdown';
import { RecentOutcomesCard } from '@/components/symphony/dashboard/RecentOutcomesCard';
import { RecentlyReadyCard } from '@/components/symphony/dashboard/RecentlyReadyCard';
import { RecommendationFunnelCard } from '@/components/symphony/dashboard/RecommendationFunnelCard';
import { TechnologySupplyCard } from '@/components/symphony/dashboard/TechnologySupplyCard';
import { useInternStats } from '@/queries/interns';

export default function LeadershipDashboardPage() {
  const { data: stats, isPending, isError } = useInternStats();
  const todayLabel = format(new Date(), 'EEEE, MMMM d, yyyy');

  const technologySupply = useMemo(
    () => (stats?.technologySupply ?? []).slice(0, 8),
    [stats?.technologySupply]
  );
  const maxReady = useMemo(
    () => Math.max(1, ...technologySupply.map((row) => row.readyCount)),
    [technologySupply]
  );
  const funnelTotal = useMemo(() => {
    if (!stats?.funnel) return 0;
    return Object.values(stats.funnel).reduce((sum, count) => sum + count, 0);
  }, [stats?.funnel]);

  const summary = stats?.summary ?? {};

  return (
    <div className="space-y-8">
      <SymphonyPageHeader
        kicker="Future Experts Programme"
        title="Programme dashboard"
        subtitle={`Supply to pitch and placements in flight — ${todayLabel}.`}
      />

      {isError && (
        <SymphonyCard>
          <p className="text-sm text-destructive">Failed to load programme statistics.</p>
        </SymphonyCard>
      )}

      <DashboardKpiBand
        isPending={isPending}
        stats={stats}
        summary={summary}
        funnel={stats?.funnel}
      />

      <DashboardUrgencyStrip
        urgent={stats?.urgent ?? []}
        pipelineAttention={stats?.pipelineAttention ?? []}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <PlacementBenchTable isPending={isPending} readyBench={stats?.readyBench ?? []} />
        <ActivePipelineTable isPending={isPending} activePipeline={stats?.activePipeline ?? []} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TechnologySupplyCard
          isPending={isPending}
          technologySupply={technologySupply}
          maxReady={maxReady}
        />
        <RecommendationFunnelCard
          isPending={isPending}
          recommendationFunnel={stats?.recommendationFunnel}
          recommendationOutcomes={stats?.recommendationOutcomes}
        />
      </div>

      <ProgrammeBreakdown
        isPending={isPending}
        funnel={stats?.funnel}
        funnelTotal={funnelTotal}
        activeByProgramme={stats?.activeByProgramme ?? []}
        activeByHub={stats?.activeByHub ?? []}
        activeInterns={summary.activeInterns ?? 0}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentlyReadyCard isPending={isPending} recentlyReady={stats?.recentlyReady ?? []} />
        <RecentOutcomesCard isPending={isPending} recentOutcomes={stats?.recentOutcomes ?? []} />
      </div>
    </div>
  );
}
