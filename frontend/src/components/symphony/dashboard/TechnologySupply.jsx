import { useState } from 'react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { cn } from '@/lib/utils';

const PALETTE = ['#6C63FF', '#4F86E8', '#2FA98C', '#DA7328', '#E0568A', '#3FB1C8', '#BC8A0E', '#B26BD6'];

const INITIAL_VISIBLE = 7;

const POSITION_POOL = [
  { name: 'Fullstack Engineer', count: 28 },
  { name: 'Frontend Engineer', count: 22 },
  { name: 'Backend Engineer', count: 19 },
  { name: 'Data Engineer', count: 14 },
  { name: 'Data Analyst', count: 11 },
  { name: 'DevOps Engineer', count: 9 },
  { name: 'Mobile Engineer', count: 8 },
  { name: 'ML Engineer', count: 7 },
  { name: 'QA Engineer', count: 5 },
  { name: 'Cloud Engineer', count: 4 },
  { name: 'Security Engineer', count: 3 },
  { name: 'Product Designer', count: 1 },
];

function RankedRow({ rank, name, count, pct, color, max, highlighted }) {
  const width = max > 0 ? Math.max(4, (count / max) * 100) : 0;
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
        highlighted && 'bg-[hsl(var(--symphony-brand)/0.06)]'
      )}
    >
      <span className="w-4 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
            {name}
          </span>
          <span className="shrink-0 text-[15px] font-bold tabular-nums text-foreground">
            {count}
          </span>
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {pct}%
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--symphony-border)/0.5)]">
          <span
            className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${width}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

function RankedPool({ kicker, title, unit, rows, emptyLabel }) {
  const [expanded, setExpanded] = useState(false);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const visible = expanded ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rows.length - INITIAL_VISIBLE;

  return (
    <SymphonyCard className="overflow-hidden p-0">
      <div className="px-4 pt-5 sm:px-[22px] sm:pt-[22px]">
        <p className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[hsl(var(--symphony-gold))]">
          {kicker}
        </p>
        <h3 className="text-[19px] font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {total} {unit} · {rows.length} {rows.length === 1 ? 'group' : 'groups'}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-3 px-2 pb-2 sm:px-3">
          {visible.map((row, i) => (
            <RankedRow
              key={row.name}
              rank={i + 1}
              name={row.name}
              count={row.count}
              pct={total > 0 ? Math.round((row.count / total) * 100) : 0}
              color={PALETTE[i % PALETTE.length]}
              max={max}
              highlighted={i === 0 && !expanded}
            />
          ))}
        </div>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mx-2 mb-2 mt-1 flex w-[calc(100%-1rem)] items-center justify-center gap-1.5 rounded-xl bg-[hsl(var(--symphony-brand)/0.06)] py-3 text-[14px] font-semibold text-[hsl(var(--symphony-brand-strong))] transition-colors hover:bg-[hsl(var(--symphony-brand)/0.1)] dark:text-[hsl(var(--symphony-brand))]"
        >
          {expanded ? 'Show fewer' : `Show ${hiddenCount} more ${title.toLowerCase()}`}
          <span className="text-[11px]">{expanded ? '▲' : '▼'}</span>
        </button>
      )}
    </SymphonyCard>
  );
}

export function TechnologySupply({ isPending, technologySupply = [] }) {
  const techRows = technologySupply
    .map((row) => ({
      name: row.technology?.name || 'Unknown',
      count: (row.readyCount ?? 0) + (row.learningCount ?? 0),
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <div className="px-4 sm:px-0">
        <h2 className="text-[19px] font-semibold text-foreground">Skills &amp; supply</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Where the intern pool sits by technology and by role.
        </p>
      </div>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
        <RankedPool
          kicker="BY TECHNOLOGY"
          title="Technologies"
          unit="interns"
          rows={isPending ? [] : techRows}
          emptyLabel={isPending ? 'Loading…' : 'No technology data yet.'}
        />
        <RankedPool
          kicker="BY POSITION"
          title="Roles in the pool"
          unit="people"
          rows={POSITION_POOL}
          emptyLabel="No role data yet."
        />
      </div>
    </div>
  );
}
