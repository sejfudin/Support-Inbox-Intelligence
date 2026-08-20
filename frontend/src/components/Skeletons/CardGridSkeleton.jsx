import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { buildArray } from '@/components/Skeletons/buildArray';

/**
 * A grid of record cards before the records arrive — the projects grid today, and the shape any
 * "wall of cards" screen wants.
 *
 * Drawn as an outlined card with placeholders inside rather than one solid grey block per cell,
 * because a `ProjectCard` is mostly card: a tinted glyph tile, a title and subtitle, a row of
 * technology pills, then a footer rule with two counts. A filled rectangle of the same size
 * reads as a heavier page than the one that lands.
 */
export default function CardGridSkeleton({
  cards = 6,
  columnsClassName = 'sm:grid-cols-2 lg:grid-cols-3',
  className,
}) {
  return (
    <div className={cn('grid gap-4', columnsClassName, className)} data-test="card-grid-skeleton">
      {buildArray(cards).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col rounded-[var(--r-card)] border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="mt-4 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="mt-3 flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="mt-4 flex items-center gap-6 border-t border-border/60 pt-3.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}
