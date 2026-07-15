import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InternPanel } from '@/components/interns/InternPanel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * @typedef {Object} SectionColumn
 * @property {string} key
 * @property {string} header
 * @property {boolean} [sortable]
 * @property {(row: any) => (string|number)} [accessor] Value used for sorting.
 * @property {(row: any) => import('react').ReactNode} render Cell content.
 * @property {'left'|'center'|'right'} [align]
 * @property {boolean} [nowrap]
 */

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const headTone =
  'bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

function SortIndicator({ state }) {
  if (state === 'asc') return <ChevronUp className="ml-1 inline h-3.5 w-3.5" />;
  if (state === 'desc') return <ChevronDown className="ml-1 inline h-3.5 w-3.5" />;
  return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
}

/**
 * Reusable history section: sortable table + "New" button + optional row action.
 * The form itself lives in a dialog owned by the consuming panel; SectionHistory
 * only exposes `onNew` / `rowAction.onClick` so the panel decides what to render.
 */
export function SectionHistory({
  title,
  columns,
  data = [],
  canWrite = false,
  newLabel = 'New',
  onNew,
  rowAction,
  onRowClick,
  isLoading = false,
  emptyMessage = 'Nothing recorded yet.',
  getRowId = (row) => row._id ?? row.id,
  dataTestPrefix,
}) {
  const [sort, setSort] = useState(() => {
    const firstSortable = columns.find((column) => column.sortable && column.accessor);
    return firstSortable ? { col: firstSortable.key, dir: 'desc' } : null;
  });

  const showRowAction = Boolean(rowAction) && canWrite;
  const totalColumns = columns.length + (showRowAction ? 1 : 0);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((item) => item.key === sort.col);
    if (!column?.accessor) return data;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = column.accessor(a);
      const bv = column.accessor(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [data, sort, columns]);

  const toggleSort = (column) => {
    if (!column.sortable || !column.accessor) return;
    setSort((prev) => {
      if (prev?.col === column.key) {
        return { col: column.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { col: column.key, dir: 'asc' };
    });
  };

  return (
    <InternPanel className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-6">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {canWrite && (
          <Button
            type="button"
            size="sm"
            onClick={onNew}
            data-test={dataTestPrefix ? `${dataTestPrefix}-new-button` : undefined}
          >
            <Plus className="h-4 w-4" />
            {newLabel}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto border-t border-border/60">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const isActive = sort?.col === column.key;
                const canSort = column.sortable && column.accessor;
                return (
                  <TableHead
                    key={column.key}
                    className={cn(
                      headTone,
                      alignClass[column.align] || alignClass.left,
                      canSort && 'cursor-pointer select-none hover:text-foreground'
                    )}
                    onClick={canSort ? () => toggleSort(column) : undefined}
                    aria-sort={
                      isActive ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    <span className="inline-flex items-center">
                      {column.header}
                      {canSort && <SortIndicator state={isActive ? sort.dir : null} />}
                    </span>
                  </TableHead>
                );
              })}
              {showRowAction && <TableHead className={cn(headTone, 'text-right')} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              [0, 1, 2].map((rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      <Skeleton className="h-4 w-full max-w-[8rem]" />
                    </TableCell>
                  ))}
                  {showRowAction && (
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-8 w-16" />
                    </TableCell>
                  )}
                </TableRow>
              ))}

            {!isLoading && sortedData.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={totalColumns}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              sortedData.map((row) => {
                const rowId = getRowId(row);
                return (
                  <TableRow
                    key={rowId}
                    data-test={dataTestPrefix ? `${dataTestPrefix}-${rowId}` : undefined}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          'align-top text-sm text-foreground',
                          alignClass[column.align] || alignClass.left,
                          column.nowrap && 'whitespace-nowrap'
                        )}
                      >
                        {column.render(row)}
                      </TableCell>
                    ))}
                    {showRowAction && (
                      <TableCell className="text-right align-top">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            rowAction.onClick(row);
                          }}
                          data-test={
                            dataTestPrefix ? `${dataTestPrefix}-${rowId}-action` : undefined
                          }
                        >
                          {rowAction.label}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </InternPanel>
  );
}

/**
 * One-line truncated cell with a tooltip for the full text and click-to-expand.
 * Pass the `{ isExpanded, toggleExpanded }` meta from the column `render` args.
 */
/**
 * One-line truncated cell, capped width so a long unbroken string can never
 * widen the cell past the viewport. Full text is available on hover via tooltip.
 */
export function TruncatedCell({ text }) {
  if (!text) return <span className="text-muted-foreground">—</span>;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block max-w-[16rem] cursor-default truncate text-sm text-foreground sm:max-w-[22rem]">
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[min(24rem,90vw)] whitespace-pre-line [overflow-wrap:anywhere]">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Renders up to `limit` badge chips, then a "+N" chip whose popover lists the rest.
 * `items` is an array of { key, label } (or plain strings).
 */
export function ChipsCell({ items = [], limit = 3, variant = 'outline', emptyLabel = '—' }) {
  const normalized = items.map((item, index) =>
    typeof item === 'string' ? { key: `${item}-${index}`, label: item } : item
  );

  if (normalized.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  const visible = normalized.slice(0, limit);
  const overflow = normalized.slice(limit);

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((item) => (
        <Badge key={item.key} variant={variant}>
          {item.label}
        </Badge>
      ))}
      {overflow.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button">
              <Badge variant="outline" className="cursor-pointer">
                +{overflow.length}
              </Badge>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto min-w-[10rem] max-w-[min(18rem,90vw)] p-2"
            align="start"
          >
            <div className="flex flex-col gap-1">
              {overflow.map((item) => (
                <span key={item.key} className="break-words text-sm text-foreground">
                  {item.label}
                </span>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
