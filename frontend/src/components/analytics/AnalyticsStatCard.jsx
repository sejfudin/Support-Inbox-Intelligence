import { cn } from '@/lib/utils';

/**
 * One KPI tile from the analytics mockup (`Insights.dc.html`): 12px radius, a
 * `13px 15px` box, and three stacked lines — label, value, hint. The value is the
 * only thing that carries colour, and only when the number itself is a verdict
 * (a healthy cycle time, a count of blocked work).
 */
const TONE_CLASS = {
  default: 'text-foreground',
  positive: 'text-[hsl(var(--tone-success-fg))]',
  negative: 'text-[hsl(var(--tone-danger-fg))]',
};

export function AnalyticsStatCard({
  label,
  value,
  hint,
  tone = 'default',
  // For values whose colour is a scale rather than one of the three verdicts —
  // an attendance rate runs green / neutral / amber / red.
  valueClassName,
  dataTest,
}) {
  return (
    <div
      className="flex flex-col gap-[5px] rounded-[var(--r-card)] border border-border bg-card px-[15px] py-[13px]"
      data-test={dataTest}
    >
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-2xl font-semibold leading-tight tracking-[-0.02em] tabular-nums',
          TONE_CLASS[tone] || TONE_CLASS.default,
          valueClassName
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-[11px] text-muted-foreground/75">{hint}</span> : null}
    </div>
  );
}

/** The mockup's stat strip — four tiles, 12px gutter, equal columns. */
export function AnalyticsStatRow({ stats = [] }) {
  if (!stats.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {stats.map((stat) => (
        <AnalyticsStatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
