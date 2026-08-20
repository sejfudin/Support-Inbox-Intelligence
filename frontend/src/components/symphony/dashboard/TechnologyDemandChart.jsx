import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader } from '@/components/ui/loader';

// Same brand-purple family used by BreakdownDonut/TechnologySupply — a dark
// shade for "Projects" and a light tint for "Interns placed" so the two
// series read as related without competing with the rest of the palette.
const PROJECTS_COLOR = '#6C63FF';
const PLACED_COLOR = '#C7C3FF';

// Reuses the same theme-aware Tailwind descendant-selector trick as
// components/ui/chart.jsx for recharts' axis/grid/tooltip internals, without
// pulling in that component's unused config/context machinery.
const CHART_THEME_CLASSES =
  '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-layer]:outline-none [&_.recharts-surface]:outline-none';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-muted-foreground">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: entry.fill }}
          />
          {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Grouped bar chart: projects requiring each technology vs. interns placed
 * on those projects. Clicking a bar (or its category label) filters the
 * project list by that technology via `onSelectTechnology`.
 */
export function TechnologyDemandChart({
  isPending,
  data = [],
  selectedTechnologyId = null,
  onSelectTechnology,
}) {
  const rows = data.map((row) => ({
    techId: row.technology?._id,
    name: row.technology?.name || 'Unknown',
    Projects: row.projectCount,
    'Interns placed': row.internsPlacedCount,
  }));

  if (isPending) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        <Loader size="sm" label="Loading demand" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No technology demand yet.
      </div>
    );
  }

  const handleBarClick = (payload) => {
    if (payload?.techId) onSelectTechnology?.(payload.techId);
  };

  const opacityFor = (techId) =>
    !selectedTechnologyId || selectedTechnologyId === techId ? 1 : 0.35;

  return (
    <div className={CHART_THEME_CLASSES} style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 8, left: -16, bottom: 8 }} barGap={4}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12.5 }}
            formatter={(value) => <span className="text-foreground">{value}</span>}
          />
          <Bar
            dataKey="Projects"
            fill={PROJECTS_COLOR}
            radius={[4, 4, 0, 0]}
            className="cursor-pointer"
            onClick={handleBarClick}
          >
            <LabelList
              dataKey="Projects"
              position="top"
              fontSize={11}
              className="fill-foreground"
            />
            {rows.map((row) => (
              <Cell key={row.techId} fillOpacity={opacityFor(row.techId)} />
            ))}
          </Bar>
          <Bar
            dataKey="Interns placed"
            fill={PLACED_COLOR}
            radius={[4, 4, 0, 0]}
            className="cursor-pointer"
            onClick={handleBarClick}
          >
            <LabelList
              dataKey="Interns placed"
              position="top"
              fontSize={11}
              className="fill-foreground"
            />
            {rows.map((row) => (
              <Cell key={row.techId} fillOpacity={opacityFor(row.techId)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
