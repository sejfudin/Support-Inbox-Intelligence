import { format } from 'date-fns';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { CohortSummaryBar } from '@/components/symphony/dashboard/CohortSummaryBar';
import { PipelineCard } from '@/components/symphony/dashboard/PipelineCard';
import { ProgrammeBreakdowns } from '@/components/symphony/dashboard/ProgrammeBreakdowns';
import { ProgrammeKpiRow } from '@/components/symphony/dashboard/ProgrammeKpiRow';
import { TechnologySupply } from '@/components/symphony/dashboard/TechnologySupply';
import { useInternStats } from '@/queries/interns';

export default function LeadershipDashboardPage() {
  const { data: stats, isPending, isError } = useInternStats();
  const todayLabel = format(new Date(), 'EEEE, MMMM d, yyyy');
  const summary = stats?.summary ?? {};

  return (
    <div className="space-y-6">
      <SymphonyPageHeader
        kicker="Future Experts Programme"
        title="Programme dashboard"
        subtitle={`Supply to pitch and placements in flight. ${todayLabel}.`}
      />

      {isError && (
        <SymphonyCard>
          <p className="text-sm text-destructive">Failed to load programme statistics.</p>
        </SymphonyCard>
      )}

      <div className="symphony-card space-y-4 p-4 sm:space-y-6 sm:p-7">
        <CohortSummaryBar isPending={isPending} funnel={stats?.funnel} summary={summary} />

        <ProgrammeKpiRow
          isPending={isPending}
          stats={stats}
          summary={summary}
          funnel={stats?.funnel}
        />
      </div>

      <div id="pipeline-card" className="scroll-mt-20">
        <PipelineCard
          isPending={isPending}
          activePipeline={stats?.activePipeline ?? []}
          activePipelineTotal={stats?.activePipelineTotal ?? 0}
          summary={summary}
          recommendationOutcomes={stats?.recommendationOutcomes}
        />
      </div>

      <TechnologySupply
        isPending={isPending}
        technologySupply={stats?.technologySupply ?? []}
        positionSupply={stats?.positionSupply ?? []}
      />

      <ProgrammeBreakdowns
        isPending={isPending}
        funnel={stats?.funnel}
        activeByProgramme={stats?.activeByProgramme ?? []}
        activeByHub={stats?.activeByHub ?? []}
      />
    </div>
  );
}
