import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const buildArray = (length) => Array.from({ length });

const StatTileSkeleton = () => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5">
      <Skeleton className="h-2 w-2 rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
    <Skeleton className="h-7 w-14" />
  </div>
);

const ItemColumnSkeleton = ({ lines }) => (
  <div className="flex flex-col gap-2 px-3 py-2">
    <div className="flex items-center gap-1.5">
      <Skeleton className="h-2 w-2 rounded-full" />
      <Skeleton className="h-4 w-16" />
    </div>
    {buildArray(lines).map((_, idx) => (
      <Skeleton key={idx} className="h-4 w-full max-w-[200px]" />
    ))}
  </div>
);

const EntryCardSkeleton = () => (
  <Card className="overflow-hidden">
    <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-border/60 bg-muted/40 py-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="grid divide-y divide-border/50 pt-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <ItemColumnSkeleton lines={2} />
      <ItemColumnSkeleton lines={2} />
      <ItemColumnSkeleton lines={1} />
    </CardContent>
  </Card>
);

/**
 * Placeholder for the workspace daily standup view while GET /api/dailies loads.
 * Mirrors DailyHeader's four stat tiles plus a couple of DailyEntryCards so the
 * panel keeps its height instead of collapsing to just the date nav.
 */
export default function DailySkeleton({ entries = 2 }) {
  return (
    <div className="flex flex-col gap-4" data-test="daily-skeleton">
      <div className="grid grid-cols-2 gap-4 border-b border-border/60 pb-5 sm:grid-cols-4">
        {buildArray(4).map((_, idx) => (
          <StatTileSkeleton key={idx} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {buildArray(entries).map((_, idx) => (
          <EntryCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
}
