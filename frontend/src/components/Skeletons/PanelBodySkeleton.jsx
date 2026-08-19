import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { buildArray } from '@/components/Skeletons/buildArray';

// Lines of prose don't end at the same place, and a stack of equal-width bars reads as a
// table rather than as text. Cycled by index so the block looks the same on every render.
const LINE_WIDTHS = ['w-[92%]', 'w-[78%]', 'w-[85%]', 'w-[64%]'];

/**
 * The inside of a panel whose header is already on screen — which is most of the intern
 * overview: `InternPanel` draws its title and tabs immediately, and only the body is waiting.
 * That is why this fills a body instead of drawing a whole card.
 *
 * `people` switches from lines of copy to rows of avatar-plus-two-lines, the shape the
 * comments, recommendations and mentors panels all resolve into.
 */
export default function PanelBodySkeleton({ rows = 3, people = false, className }) {
  if (people) {
    return (
      <div className={cn('space-y-3 pt-3', className)} data-test="panel-body-skeleton">
        {buildArray(rows).map((_, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-48 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2.5 pt-3', className)} data-test="panel-body-skeleton">
      {buildArray(rows).map((_, idx) => (
        <Skeleton key={idx} className={cn('h-3', LINE_WIDTHS[idx % LINE_WIDTHS.length])} />
      ))}
    </div>
  );
}
