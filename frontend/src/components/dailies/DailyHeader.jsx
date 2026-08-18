import { cn } from '@/lib/utils';

/**
 * The four counts under the date row, per the mockup: a plain label over a 20px
 * value, divided from the row above by a hairline. The colour is carried by the
 * number alone — the leading status dots the tiles used to have restated what the
 * label already said.
 */
const StatTile = ({ label, value, valueClassName }) => (
  <div className="flex flex-col gap-[3px]">
    <span className="text-[11.5px] text-muted-foreground">{label}</span>
    <span className={cn('text-[20px] font-semibold leading-tight', valueClassName)}>{value}</span>
  </div>
);

export const DailyHeader = ({ counts }) => {
  const covered = counts?.covered ?? { present: 0, total: 0 };
  const blockers = counts?.blockers ?? 0;

  return (
    <div className="mt-[13px] grid grid-cols-2 gap-3 border-t border-separator pt-[13px] sm:grid-cols-4">
      <StatTile
        label="Team covered"
        value={`${covered.present} / ${covered.total}`}
        valueClassName="text-foreground"
      />
      <StatTile
        label="Shipped"
        value={counts?.shipped ?? 0}
        valueClassName="text-[hsl(var(--tone-success-fg))]"
      />
      <StatTile
        label="In flight"
        value={counts?.inFlight ?? 0}
        valueClassName="text-[hsl(var(--tone-info-fg))]"
      />
      {/* Zero blockers is good news, so it stays neutral — only a real count
          earns the alarm colour. */}
      <StatTile
        label="Blockers"
        value={blockers}
        valueClassName={blockers > 0 ? 'text-[hsl(var(--tone-danger-fg))]' : 'text-foreground'}
      />
    </div>
  );
};
