import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buildArray } from '@/components/Skeletons/buildArray';

export default function TableSkeleton({
  columns = 5,
  rows = 6,
  minWidthClassName = 'min-w-[900px]',
}) {
  const colItems = buildArray(columns);
  const rowItems = buildArray(rows);

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto">
        <Table className={`table-fixed ${minWidthClassName}`}>
          <TableHeader>
            <TableRow>
              {colItems.map((_, idx) => (
                <TableHead key={`head-${idx}`}>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowItems.map((_, rowIdx) => (
              <TableRow key={`row-${rowIdx}`}>
                {colItems.map((_, colIdx) => (
                  <TableCell key={`cell-${rowIdx}-${colIdx}`}>
                    <Skeleton className="h-4 w-full max-w-[220px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* The pager placeholders track `--h-md`, so the skeleton is the same height
          as the buttons that replace it — at a fixed 32px the row would jump when
          the real pager landed under compact density. */}
      <div className="flex flex-col gap-3 border-t border-separator px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-[var(--control-gap)] self-end sm:self-auto">
          <Skeleton className="h-[var(--h-md)] w-[var(--h-md)] rounded-[var(--r-control)]" />
          <Skeleton className="h-[var(--h-md)] w-[var(--h-md)] rounded-[var(--r-control)]" />
        </div>
      </div>
    </div>
  );
}
