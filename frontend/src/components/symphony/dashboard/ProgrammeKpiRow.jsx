import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { cn } from '@/lib/utils';

function KpiCard({ label, value, hint, dot, highlighted }) {
  return (
    <SymphonyCard className="relative overflow-hidden p-0">
      {highlighted && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[hsl(var(--symphony-brand)/0.1)]"
        />
      )}
      <div className="relative px-5 py-[22px]">
        <div className="flex items-center gap-2">
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
            style={{ backgroundColor: dot }}
          />
          <span className="text-[12.5px] font-semibold text-foreground/80">{label}</span>
        </div>
        <div className="mt-3.5 text-[40px] font-bold leading-none tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        {hint && <p className="mt-2.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
      </div>
    </SymphonyCard>
  );
}

export function ProgrammeKpiRow({ isPending, stats, summary, funnel, accent = 'Ready to pitch' }) {
  const dash = '—';
  const kpis = [
    {
      label: 'Ready to pitch',
      value: isPending ? dash : (stats?.readyForPlacement ?? 0),
      hint: 'Mentor-flagged and available now',
      dot: '#726BFF',
    },
    {
      label: 'Waiting on a pitch',
      value: isPending ? dash : (summary?.readyWithoutActiveRecommendation ?? 0),
      hint: 'Ready but not yet recommended',
      dot: '#F0B45B',
    },
    {
      label: 'In pipeline',
      value: isPending ? dash : (summary?.activeRecommendations ?? 0),
      hint: 'Recommended or interviewing',
      dot: '#5B7CFA',
    },
    {
      label: 'Interviewing',
      value: isPending ? dash : (summary?.interviewingCount ?? 0),
      hint: 'Active interview processes',
      dot: '#8AD1C2',
    },
    {
      label: 'Placed',
      value: isPending ? dash : (funnel?.placed ?? summary?.placedInterns ?? 0),
      hint: 'Successfully placed this cycle',
      dot: '#E88AA6',
    },
  ];

  return (
    <section
      className={cn('grid gap-4', '[grid-template-columns:repeat(auto-fit,minmax(188px,1fr))]')}
    >
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} highlighted={!isPending && kpi.label === accent} />
      ))}
    </section>
  );
}
