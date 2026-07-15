import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from 'recharts';
import { cn } from '@/lib/utils';

// Fixed slot order keeps colours distinct under CVD; do not sort by value.
const PALETTE = ['#6C63FF', '#2FA98C', '#DA7328', '#E0568A', '#4F86E8', '#BC8A0E', '#B26BD6'];

const pctOf = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

function ActiveShape(props) {
  const { outerRadius, ...rest } = props;
  return <Sector {...rest} outerRadius={outerRadius + 6} />;
}

function RankedBars({ rows, total, colorFor, onSelect }) {
  const ranked = rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => b.row.value - a.row.value);

  return (
    <ul className="flex flex-col gap-1">
      {ranked.map(({ row, i }) => {
        const pct = pctOf(row.value, total);
        return (
          <li key={row.name}>
            <button
              type="button"
              onClick={() => onSelect(row)}
              disabled={!row.href}
              className={cn(
                'flex min-h-[44px] w-full flex-col justify-center gap-1.5 rounded-lg px-2.5 py-2 text-left transition-colors active:bg-[hsl(var(--symphony-brand)/0.08)]',
                row.href ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: colorFor(i) }}
                />
                <span className="flex-1 truncate text-[13.5px] font-medium text-foreground">
                  {row.name}
                </span>
                <span className="tabular-nums text-[13.5px] font-semibold text-foreground">
                  {row.value}
                </span>
                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </span>
              <span className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--symphony-border)/0.55)]">
                <span
                  className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${pct}%`, backgroundColor: colorFor(i) }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function BreakdownDonut({ rows = [], emptyLabel = 'No data yet.' }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(null);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  const go = (row) => {
    if (row?.href) navigate(row.href);
  };

  if (rows.length === 0 || total === 0) {
    return (
      <div className="flex h-[196px] items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const activeRow = active !== null ? rows[active] : null;

  const colorFor = (i) => PALETTE[i % PALETTE.length];

  return (
    <div>
      <div className="sm:hidden">
        <RankedBars rows={rows} total={total} colorFor={colorFor} onSelect={go} />
      </div>
      <div className="hidden sm:block">
      <div className="relative h-[184px] w-full sm:h-[196px]">
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="flex w-[104px] flex-col items-center">
            {activeRow ? (
              <>
                <span className="text-[26px] font-bold leading-none tracking-tight text-foreground tabular-nums">
                  {pctOf(activeRow.value, total)}%
                </span>
                <span className="mt-1.5 line-clamp-2 w-full text-[11px] font-medium leading-tight text-muted-foreground">
                  {activeRow.name}
                </span>
              </>
            ) : (
              <>
                <span className="text-[30px] font-bold leading-none tracking-tight text-foreground tabular-nums">
                  {total}
                </span>
                <span className="mt-1.5 text-[11px] font-medium leading-none tracking-[0.08em] text-muted-foreground">
                  TOTAL
                </span>
              </>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              cornerRadius={4}
              stroke="hsl(var(--symphony-surface-elevated))"
              strokeWidth={3}
              activeIndex={active ?? undefined}
              activeShape={ActiveShape}
              onClick={(datum) => go(datum?.payload ?? datum)}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className="cursor-pointer [&_.recharts-sector]:outline-none"
              isAnimationActive={false}
            >
              {rows.map((row, i) => (
                <Cell
                  key={row.name}
                  fill={PALETTE[i % PALETTE.length]}
                  className="transition-opacity duration-150"
                  style={{ opacity: active === null || active === i ? 1 : 0.32 }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 flex flex-col gap-0.5">
        {rows.map((row, i) => {
          const isActive = active === i;
          return (
            <li key={row.name}>
              <button
                type="button"
                onClick={() => go(row)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                disabled={!row.href}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                  row.href ? 'cursor-pointer' : 'cursor-default',
                  isActive && 'bg-[hsl(var(--symphony-brand)/0.08)]'
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px] transition-transform duration-150"
                  style={{
                    backgroundColor: PALETTE[i % PALETTE.length],
                    transform: isActive ? 'scale(1.25)' : 'none',
                  }}
                />
                <span
                  className={cn(
                    'flex-1 truncate font-medium text-foreground',
                    isActive &&
                      'text-[hsl(var(--symphony-brand-strong))] dark:text-[hsl(var(--symphony-brand))]'
                  )}
                >
                  {row.name}
                </span>
                <span className="tabular-nums font-semibold text-foreground">{row.value}</span>
                <span className="w-9 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
                  {pctOf(row.value, total)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      </div>
    </div>
  );
}
