import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { buildArray } from '@/components/Skeletons/buildArray';

// Cells of one width read as a spreadsheet; real rows are ragged. Cycled by index so the
// block is stable across renders.
const CELL_WIDTHS = ['w-24', 'w-16', 'w-28', 'w-20'];

/**
 * Skeleton `<tr>`s to drop straight into an existing `<tbody>`.
 *
 * `TableSkeleton` replaces a whole table — header, body and pager — which is right for the
 * paged ticket and user tables. The hand-rolled tables on the intern and candidate screens have
 * no pager, and their header is static markup that has nothing to wait for: rendering it and
 * filling only the rows keeps the column widths, the filter bar and the card edge exactly where
 * they will be, so the arriving data changes nothing but the cells.
 *
 * `firstColumn="person"` draws the avatar-and-two-lines shape those first cells resolve into.
 */
export default function TableRowsSkeleton({
  rows = 6,
  columns = 5,
  firstColumn = 'text',
  cellClassName = 'px-5 py-3',
}) {
  return buildArray(rows).map((_, rowIdx) => (
    <tr key={rowIdx} className="border-b border-border/60 last:border-0">
      {buildArray(columns).map((_, colIdx) => (
        <td key={colIdx} className={cellClassName}>
          {colIdx === 0 && firstColumn === 'person' ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-40" />
              </div>
            </div>
          ) : (
            <Skeleton className={cn('h-3', CELL_WIDTHS[(rowIdx + colIdx) % CELL_WIDTHS.length])} />
          )}
        </td>
      ))}
    </tr>
  ));
}
