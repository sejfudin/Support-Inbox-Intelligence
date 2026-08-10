import { IN_PIPELINE_STAGE } from '@/helpers/internProfile';
import { KpiCard } from '@/components/symphony/dashboard/KpiCard';
import { cn } from '@/lib/utils';

function FlowStep({ label, muted }) {
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        muted
          ? 'bg-muted/60 text-muted-foreground'
          : 'bg-[hsl(var(--symphony-brand)/0.12)] text-[hsl(var(--symphony-brand-strong))] dark:text-[hsl(var(--symphony-brand))]'
      )}
    >
      {label}
    </span>
  );
}

function PipelineFlow() {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-1.5">
      <FlowStep label="Ready" muted />
      <span className="text-muted-foreground">→</span>
      <FlowStep label="Interview" />
      <span className="text-muted-foreground">→</span>
      <FlowStep label="Placed" muted />
    </div>
  );
}

export function ProgrammeKpiRow({ isPending, stats, summary, funnel, accent = null }) {
  const dash = '—';
  // Ready pool = interns on the bench NOT yet in selection. Deducting the
  // active-recommendation interns keeps the three cards mutually exclusive, so
  // Ready + In Selection + Placed reads as a clean funnel with no double-count.
  const ready = summary?.readyWithoutActiveRecommendation ?? stats?.readyForPlacement ?? 0;
  const inPipeline = summary?.activeRecommendations ?? 0;
  const placed = funnel?.placed ?? summary?.placedInterns ?? 0;

  const scrollToPipeline = () =>
    document
      .getElementById('pipeline-card')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const kpis = [
    {
      label: 'Available for a project',
      value: isPending ? dash : ready,
      hint: 'Ready and on the bench — not yet put forward or on a project',
      dot: '#726BFF',
      to: '/interns?status=ready',
      testId: 'programme-kpi-ready-link',
      info: (
        <>
          A mentor has confirmed these interns are ready to take on a real project, and they are not
          yet being pitched — free to be put forward as soon as a position opens.
          <span className="mt-2 block">
            Interns in <span className="font-semibold text-foreground">In Selection</span> are still
            ready too; they are counted there instead of here so nobody is counted twice. A failed
            interview brings an intern back to this count.
          </span>
        </>
      ),
    },
    {
      label: 'In Selection',
      value: isPending ? dash : inPipeline,
      hint: 'Put forward for a role — recommended or interviewing',
      dot: '#5B7CFA',
      to: `/interns?status=${IN_PIPELINE_STAGE}`,
      testId: 'programme-kpi-pipeline-link',
      action: { label: 'See details', onClick: scrollToPipeline },
      info: (
        <>
          Interns who are ready and now being pitched to clients — recommended or actively
          interviewing. They move through:
          <PipelineFlow />
          <span className="mt-2 block">
            If an interview does not work out, the intern goes back to being ready and can be
            recommended again.
          </span>
        </>
      ),
    },
    {
      label: 'Placed on a project',
      value: isPending ? dash : placed,
      hint: 'Interviews cleared — now staffed on a client project',
      dot: '#E88AA6',
      to: '/interns?status=placed',
      testId: 'programme-kpi-placed-link',
      info: 'Interns who cleared their interviews and are now staffed on a client project. This is the end of the selection process.',
    },
  ];

  return (
    <section
      className={cn('grid gap-4', '[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]')}
    >
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} highlighted={!isPending && kpi.label === accent} />
      ))}
    </section>
  );
}
