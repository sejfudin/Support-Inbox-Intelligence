import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const buildArray = (length) => Array.from({ length });

export default function BoardSkeleton({ columns = 4, cards = 3 }) {
  const colItems = buildArray(columns);
  const cardItems = buildArray(cards);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4">
        {colItems.map((_, colIdx) => (
          <div
            key={`col-${colIdx}`}
            className="w-[320px] shrink-0 rounded-lg border-t-4 border-slate-200 bg-white"
          >
            <div className="p-4 pb-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-16" />
            </div>
            <div className="px-4 pb-4 space-y-3">
              {cardItems.map((_, cardIdx) => (
                <div
                  key={`card-${colIdx}-${cardIdx}`}
                  className="rounded-md border p-3"
                >
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
