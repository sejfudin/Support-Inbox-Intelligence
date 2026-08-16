import { cn } from '@/lib/utils';

/**
 * Compact summary stat tile used in the attendance overview stat row.
 * @param {{ label: string, value: React.ReactNode, hint?: string, icon?: React.ComponentType, valueClassName?: string }} props
 */
export default function AttendanceStat({ label, value, hint, icon: Icon, valueClassName }) {
  return (
    <div className="app-card flex items-center gap-4 p-4 md:p-5">
      {Icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-card)] bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-semibold text-foreground', valueClassName)}>{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
