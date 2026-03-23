import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const buildArray = (length) => Array.from({ length });

export default function TableSkeleton({
  columns = 5,
  rows = 6,
  minWidthClassName = "min-w-[900px]",
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

      <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}
