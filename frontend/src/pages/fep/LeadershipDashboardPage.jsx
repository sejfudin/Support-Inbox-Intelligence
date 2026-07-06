import { format } from 'date-fns';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { PipelineCard } from '@/components/symphony/dashboard/PipelineCard';
import { ProgrammeBreakdowns } from '@/components/symphony/dashboard/ProgrammeBreakdowns';
import { ProgrammeKpiRow } from '@/components/symphony/dashboard/ProgrammeKpiRow';
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

      <ProgrammeKpiRow
        isPending={isPending}
        stats={stats}
        summary={summary}
        funnel={stats?.funnel}
      />

      <PipelineCard
        isPending={isPending}
        activePipeline={stats?.activePipeline ?? []}
        recommendationOutcomes={stats?.recommendationOutcomes}
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
