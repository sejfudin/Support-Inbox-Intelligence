import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function InfoPopover({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What does “${title}” mean?`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--symphony-brand))]/40 rounded-full"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

function FlowStep({ label, muted }) {
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        muted ? 'bg-muted/60 text-muted-foreground' : 'bg-[hsl(var(--symphony-brand)/0.12)] text-[hsl(var(--symphony-brand-strong))] dark:text-[hsl(var(--symphony-brand))]'
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

function KpiCard({ label, value, sub, hint, dot, highlighted, info }) {
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
          <span className="h-[9px] w-[9px] shrink-0 rounded-[3px]" style={{ backgroundColor: dot }} />
          <span className="text-[12.5px] font-semibold text-foreground/80">{label}</span>
          {info && (
            <span className="ml-auto">
              <InfoPopover title={label}>{info}</InfoPopover>
            </span>
          )}
        </div>
        <div className="mt-3.5 flex items-baseline gap-2">
          <span className="text-[40px] font-bold leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </span>
          {sub && (
            <span className="text-[13px] font-medium text-foreground/60">
              <span className="mr-1 text-foreground/40">/</span>
              {sub}
            </span>
          )}
        </div>
        {hint && <p className="mt-2.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
      </div>
    </SymphonyCard>
  );
}

export function ProgrammeKpiRow({ isPending, stats, summary, funnel, accent = null }) {
  const dash = '—';
  const ready = stats?.readyForPlacement ?? 0;
  const inPipeline = summary?.activeRecommendations ?? 0;
  const interviewing = summary?.interviewingCount ?? 0;
  const notInPipeline = summary?.readyWithoutActiveRecommendation ?? 0;
  const recommended = Math.max(0, ready - notInPipeline);
  const awaitingInterview = Math.max(0, inPipeline - interviewing);
  const placed = funnel?.placed ?? summary?.placedInterns ?? 0;

  const pipelineHint = [
    interviewing > 0 && `${interviewing} in a process of interviewing`,
    awaitingInterview > 0 && `${awaitingInterview} recommended and awaiting an interview`,
  ]
    .filter(Boolean)
    .join(', ');

  const kpis = [
    {
      label: 'Ready for a project',
      value: isPending ? dash : ready,
      sub: !isPending && recommended > 0 ? `${recommended} recommended` : null,
      hint: 'Interns ready for a project',
      dot: '#726BFF',
      info: (
        <>
          A mentor has confirmed these interns have enough knowledge to take on a real project
          once a position opens, so they can go to interviews.
          <span className="mt-2 block">
            <span className="font-semibold text-foreground">Recommended</span> is the next step:
            a mentor thinks the intern fits a specific open position and puts them forward for it.
            Every recommended intern is still ready for a project; not every ready intern has been
            recommended yet.
          </span>
        </>
      ),
    },
    {
      label: 'In pipeline',
      value: isPending ? dash : inPipeline,
      sub: !isPending && interviewing > 0 ? `${interviewing} interviewing` : null,
      hint: pipelineHint || 'In a process of interview or waiting interview results',
      dot: '#5B7CFA',
      info: (
        <>
          Interns being pitched to clients, either recommended or actively interviewing. They move
          through:
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
      hint: 'Successfully placed on the project',
      dot: '#E88AA6',
      info: 'Candidates who cleared interviews and have been placed on a client project.',
    },
  ];

  return (
    <section className={cn('grid gap-4', '[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]')}>
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} highlighted={!isPending && kpi.label === accent} />
      ))}
    </section>
  );
}
