import { SymphonyCard } from '@/components/symphony/SymphonyCard';

const READY_COLOR = '#6C63FF';
const LEARNING_COLOR = '#E0A93B';

const POSITION_SUPPLY = [
  { name: 'Web', ready: 6, learning: 3 },
  { name: 'Mobile', ready: 3, learning: 2 },
  { name: 'Data Engineering', ready: 2, learning: 2 },
  { name: 'Machine Learning', ready: 1, learning: 3 },
  { name: 'DevOps', ready: 1, learning: 1 },
];

function SupplyBar({ name, ready, learning, max }) {
  const total = ready + learning;
  const readyPct = max > 0 ? (ready / max) * 100 : 0;
  const learningPct = max > 0 ? (learning / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-[13.5px] font-medium text-foreground">{name}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{ready}</span> ready
          {learning > 0 && <> · {learning} learning</>}
        </span>
      </div>
      <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full bg-[hsl(var(--symphony-border)/0.4)]">
        {ready > 0 && (
          <span style={{ width: `${readyPct}%`, backgroundColor: READY_COLOR }} className="block" />
        )}
        {learning > 0 && (
          <span
            style={{ width: `${learningPct}%`, backgroundColor: LEARNING_COLOR }}
            className="block"
          />
        )}
        {total === 0 && <span className="block w-1.5 bg-[hsl(var(--symphony-border))]" />}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
      <span className="flex items-center gap-2 text-[12.5px] font-medium text-foreground/80">
        <span className="h-[9px] w-[9px] rounded-[3px]" style={{ backgroundColor: READY_COLOR }} />
        Ready for a project
      </span>
      <span className="flex items-center gap-2 text-[12.5px] font-medium text-foreground/80">
        <span
          className="h-[9px] w-[9px] rounded-[3px]"
          style={{ backgroundColor: LEARNING_COLOR }}
        />
        Still learning
      </span>
    </div>
  );
}

function SupplyCard({ kicker, title, subtitle, rows, emptyLabel }) {
  const max = Math.max(1, ...rows.map((r) => r.ready + r.learning));
  return (
    <SymphonyCard className="px-4 pb-5 pt-5 sm:px-[22px] sm:pt-[22px]">
      <p className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[hsl(var(--symphony-gold))]">
        {kicker}
      </p>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}

      {rows.length === 0 ? (
        <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-4 space-y-3.5">
          {rows.map((row) => (
            <SupplyBar key={row.name} {...row} max={max} />
          ))}
        </div>
      )}
      <Legend />
    </SymphonyCard>
  );
}

export function TechnologySupply({ isPending, technologySupply = [] }) {
  const techRows = technologySupply
    .map((row) => ({
      name: row.technology?.name || 'Unknown',
      ready: row.readyCount ?? 0,
      learning: row.learningCount ?? 0,
    }))
    .sort((a, b) => b.ready + b.learning - (a.ready + a.learning))
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="px-4 sm:px-0">
        <h2 className="text-[19px] font-semibold text-foreground">Skills &amp; supply</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Where interns are allocated by technology and position, and how many are ready.
        </p>
      </div>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <SupplyCard
          kicker="BY TECHNOLOGY"
          title="Technology supply"
          subtitle="Interns ready for or currently learning each stack."
          rows={isPending ? [] : techRows}
          emptyLabel={isPending ? 'Loading…' : 'No technology data yet.'}
        />
        <SupplyCard
          kicker="BY POSITION"
          title="Position supply"
          subtitle="Readiness across the roles we place into."
          rows={POSITION_SUPPLY}
          emptyLabel="No position data yet."
        />
      </div>
    </div>
  );
}
