import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsCardSkeleton() {
  return (
    <Card className="app-panel">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-44" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[260px] w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}
