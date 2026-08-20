import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { buildArray } from '@/components/Skeletons/buildArray';

/**
 * The list-beside-detail layout the staffing, requests and projects screens share: a column
 * of cards on the left, one open record on the right, collapsing to the list alone below `lg`.
 *
 * Extracted from `AdminStaffingRequestsPage`, which had it inline with the comment that says
 * why it exists at all: a single "Loading requests…" line left the page empty and then
 * rearranged it into two panes. The skeleton has to be the same grid as the thing it stands in
 * for, or it swaps one layout jump for another.
 *
 * The detail pane is `hidden lg:block` deliberately — on a narrow screen only the list is
 * mounted, so a placeholder for the pane would be a promise of something that isn't coming.
 */
export default function TwoPaneSkeleton({
  rows = 4,
  rowClassName = 'h-[104px]',
  detailClassName = 'h-[420px]',
  // The three screens size their list column slightly differently. Passed as its own prop for
  // the same reason `StatBandSkeleton` takes its columns: two `lg:grid-cols-*` utilities in one
  // class list don't resolve to the narrower one, they just both sit there.
  columnsClassName = 'lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]',
  className,
}) {
  return (
    <div className={cn('grid gap-4', columnsClassName, className)} data-test="two-pane-skeleton">
      <div className="space-y-3">
        {buildArray(rows).map((_, idx) => (
          <Skeleton key={idx} className={cn('w-full rounded-[var(--r-card)]', rowClassName)} />
        ))}
      </div>
      <Skeleton className={cn('hidden w-full rounded-[var(--r-card)] lg:block', detailClassName)} />
    </div>
  );
}
