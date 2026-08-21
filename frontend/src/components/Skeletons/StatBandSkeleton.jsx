import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { buildArray } from '@/components/Skeletons/buildArray';

/**
 * The KPI strip that opens the attendance, insights and analytics pages, as it looks before
 * its numbers arrive. Geometry is copied from `AnalyticsStatCard` — 12px radius, a `13px 15px`
 * box, three stacked lines — so the tiles do not change size when the real ones land.
 *
 * `columnsClassName` is a prop rather than something to pass through `className`, because the
 * pages disagree about where the strip breaks to four across (`lg` on the insights page, `xl`
 * in `AnalyticsStatRow`) and two grid-column utilities on different breakpoints would both
 * apply instead of one winning.
 */
export default function StatBandSkeleton({
  tiles = 4,
  columnsClassName = 'grid-cols-2 xl:grid-cols-4',
  className,
}) {
  return (
    <div className={cn('grid gap-3', columnsClassName, className)} data-test="stat-band-skeleton">
      {buildArray(tiles).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col gap-[5px] rounded-[var(--r-card)] border border-border bg-card px-[15px] py-[13px]"
        >
          <Skeleton className="h-3 w-24" />
          {/* The value line is `text-2xl` with tight leading — 28px, not the 16px a default
              skeleton bar would give it, which is what makes the tile the right height. */}
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}
