import { Skeleton } from '@/components/ui/skeleton';
import { buildArray } from '@/components/Skeletons/buildArray';

/**
 * The board's loading state. It has to be laid out on the same rules as the real
 * board (`BoardPage`), not on fixed-width columns in a horizontal scroller:
 *
 * - same width band — `flex: 1 1 var(--board-col-min)` with a
 *   `var(--board-col-max)` ceiling — so the skeleton reclaims the width a
 *   collapsed rail frees exactly as the loaded board does, and the columns don't
 *   jump sideways the moment the statuses arrive;
 * - `flex-wrap`, never `overflow-x`. The board never scrolls sideways at any
 *   width, and its loading state is not an exception.
 *
 * Five columns because that is the default workspace's board (`To do`,
 * `In progress`, `On staging`, `Blocked`, `Done` — `Backlog` is not a column).
 */
export default function BoardSkeleton({ columns = 5, cards = 3 }) {
  const colItems = buildArray(columns);
  const cardItems = buildArray(cards);

  return (
    <div className="flex w-full flex-wrap items-stretch gap-3 pb-5">
      {colItems.map((_, colIdx) => (
        <div
          key={`col-${colIdx}`}
          className="flex min-w-0 max-w-[var(--board-col-max)] flex-[1_1_var(--board-col-min)] flex-col overflow-hidden rounded-[var(--r-card)] border border-border bg-card"
          // 2px top edge as an inline style, matching the real column — as a
          // class it would race `border` for source order in the same layer.
          style={{ borderTopWidth: 2 }}
        >
          <div className="flex shrink-0 items-center gap-1.5 border-b border-separator px-2.5 pb-2.5 pt-[11px]">
            <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="ml-auto h-4 w-6 rounded-full" />
          </div>
          <div className="flex flex-col gap-2 p-2.5">
            {cardItems.map((_, cardIdx) => (
              <div
                key={`card-${colIdx}-${cardIdx}`}
                className="rounded-[var(--r-tile)] border border-separator p-2.5"
              >
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
