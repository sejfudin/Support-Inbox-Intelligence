import { cn } from '@/lib/utils';

const STAT_STYLES = {
  covered: { dot: 'bg-violet-500', value: 'text-foreground' },
  shipped: { dot: 'bg-emerald-500', value: 'text-emerald-600 dark:text-emerald-400' },
  inFlight: { dot: 'bg-blue-500', value: 'text-blue-600 dark:text-blue-400' },
  blockers: { dot: 'bg-red-500', value: 'text-red-600 dark:text-red-400' },
};

const StatTile = ({ label, value, styleKey }) => {
  const style = STAT_STYLES[styleKey];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', style.dot)} />
        {label}
      </div>
      <span className={cn('text-2xl font-bold leading-none', style.value)}>{value}</span>
    </div>
  );
};

export const DailyHeader = ({ counts }) => {
  const covered = counts?.covered ?? { present: 0, total: 0 };

  return (
    <div className="flex flex-col gap-2 border-b border-border/60 pb-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Team covered"
          value={`${covered.present}/${covered.total}`}
          styleKey="covered"
        />
        <StatTile label="Shipped" value={counts?.shipped ?? 0} styleKey="shipped" />
        <StatTile label="In flight" value={counts?.inFlight ?? 0} styleKey="inFlight" />
        <StatTile label="Blockers" value={counts?.blockers ?? 0} styleKey="blockers" />
      </div>
    </div>
  );
};
