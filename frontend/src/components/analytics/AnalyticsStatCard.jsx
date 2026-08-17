import { cn } from '@/lib/utils';

/**
 * One number with its label and a line of context under it.
 *
 * The value uses `.app-stat-value` rather than its own font size — every headline
 * number in the app reads at one size, and that is the class that decides it.
 * `hint` is the qualifier the number is meaningless without ("Last 30 days",
 * "Assigned now"): a bare 12 on an analytics card invites the reader to guess the
 * period, so the tile keeps room for it even when it is absent.
 */
export function AnalyticsStatCard({ label, value, hint, className }) {
  return (
    <div className={cn('app-panel-soft px-4 py-3', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75">
        {label}
      </p>
      <p className="app-stat-value mt-1">{value ?? '—'}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground/75">{hint}</p> : null}
    </div>
  );
}

/**
 * The row of tiles above an analytics card's charts. Two up on a phone, four
 * across from `sm` — the stat rows this backs are all four tiles, and a 1×4 column
 * on a narrow screen pushes the charts below the fold.
 */
export function AnalyticsStatRow({ stats = [], className }) {
  if (!stats.length) return null;

  return (
    <div className={cn('grid grid-cols-2 gap-3.5 sm:grid-cols-4', className)}>
      {stats.map((stat) => (
        <AnalyticsStatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          hint={stat.hint}
        />
      ))}
    </div>
  );
}

export default AnalyticsStatCard;
