import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IN_PIPELINE_STAGE } from '@/helpers/internProfile';
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

function KpiCard({ label, value, sub, hint, dot, highlighted, info, to, testId, action }) {
  return (
    <SymphonyCard
      variant="muted"
      className="relative overflow-hidden p-0 transition-shadow hover:shadow-md"
    >
      {highlighted && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[hsl(var(--symphony-brand)/0.1)]"
        />
      )}
      {to && (
        <Link
          to={to}
          aria-label={`View candidates: ${label}`}
          data-test={testId}
          className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--symphony-brand))]/40"
        />
      )}
      <div className="relative px-5 py-[22px]">
        <div className="flex items-center gap-2">
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
            style={{ backgroundColor: dot }}
          />
          <span className="text-[12.5px] font-semibold text-foreground/80">{label}</span>
          {info && (
            <span className="relative z-[2] ml-auto">
              <InfoPopover title={label}>{info}</InfoPopover>
            </span>
          )}
        </div>
        <div className="mt-3.5 flex items-baseline gap-2">
          <span className="text-[48px] font-bold leading-none tracking-tight text-foreground tabular-nums">
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
        {action && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              action.onClick();
            }}
            className="relative z-[2] mt-3 inline-flex items-center gap-0.5 text-xs font-semibold text-[hsl(var(--symphony-brand-strong))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--symphony-brand))]/40 dark:text-[hsl(var(--symphony-brand))]"
          >
            {action.label}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </SymphonyCard>
  );
}

export function ProgrammeKpiRow({ isPending, stats, summary, funnel, accent = null }) {
  const dash = '—';
  // Ready pool = interns on the bench NOT yet in the pipeline. Deducting the
  // active-recommendation interns keeps the three cards mutually exclusive, so
  // Ready + In pipeline + Placed reads as a clean funnel with no double-count.
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
            Interns in <span className="font-semibold text-foreground">In pipeline</span> are still
            ready too; they are counted there instead of here so nobody is counted twice. A failed
            interview brings an intern back to this count.
          </span>
        </>
      ),
    },
    {
      label: 'In pipeline',
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
      info: 'Interns who cleared their interviews and are now staffed on a client project. This is the end of the pipeline.',
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
