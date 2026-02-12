import { Skeleton } from "@/components/ui/skeleton";

export default function GlobalSkeleton () {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <div className="hidden w-64 border-r bg-slate-50/50 p-4 md:flex flex-col gap-6">
        <div className="flex items-center gap-2 px-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center justify-between px-6 bg-white">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 md:hidden" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 bg-gray-50/50">
        <div className="bg-white border rounded-lg p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};