import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function DataTable({
  columns,
  data,
  pagination,
  onPageChange,
  meta,
  hideHeader = false,
  // Pass both to hand the sort to the server (see `useTicketList`'s `defaultSort`).
  // Without them the headers stay inert text — never a client-side sort. Every list
  // on this table is paginated, so reordering the rows one page happens to hold is
  // not a sort; it is a control that looks like one and lies. Opt in or do without.
  sorting: controlledSorting,
  onSortingChange,
  // 840px is the mockup's floor for the seven-column grid; below it the section
  // scrolls inside itself rather than letting the subject column collapse.
  tableClassName = 'min-w-[840px] table-fixed',
  // Opt-in row selection: `{ selectedIds: Set, onToggle(id), onToggleAll(), idPrefix }`.
  // A prop rather than a column definition, so the callers that don't select
  // (the backlog, the archive) are untouched, and so the checkbox column cannot
  // be reordered into the middle of the mockup's grid by accident.
  selection = null,
}) {
  // Sorting exists only when the caller owns the state and sends it to the API.
  // A paginated list can only be sorted by the API: ordering the 25 rows this page
  // holds is not a sort. Uncontrolled callers get plain, unclickable headers.
  const isServerSorted = typeof onSortingChange === 'function';
  const sorting = controlledSorting ?? [];

  const handleSortingChange = (updater) => {
    if (!isServerSorted) return;
    onSortingChange(typeof updater === 'function' ? updater(sorting) : updater);
  };
  const currentPage = pagination?.page || 1;
  const totalResults = pagination?.total || 0;
  // Only a fallback for the frame before the first response carries `pagination.limit`.
  // Kept in step with `useTicketList`'s page size, which every consumer of this table
  // uses — a stale number here would print a "1–10 of 240" range for a 25-row page.
  const limit = pagination?.limit || 25;

  const from = totalResults === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to = Math.min(currentPage * limit, totalResults);

  const selectionPrefix = selection?.idPrefix || 'tickets-table';
  const rowIds = data.map((ticket) => ticket.id ?? ticket._id);
  // "All" means the page, not the result set — the header box can only speak for
  // the rows it is on top of, and the count in the bar has to match what it ticks.
  const allRowsSelected =
    Boolean(selection) && rowIds.length > 0 && rowIds.every((id) => selection.selectedIds.has(id));

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: handleSortingChange,
    // Never a client row model: the rows arrive in the order the API chose, and
    // re-sorting them here would only reorder the current page.
    state: {
      sorting,
    },
    manualPagination: true,
    manualSorting: true,
    // Gates `getCanSort()`, so an uncontrolled caller renders headers as plain text
    // with no click target — the behaviour before this table learned to sort.
    enableSorting: isServerSorted,
    // Third click would otherwise clear the sort, and an unordered paginated
    // list pages inconsistently. Sorting cycles asc/desc only.
    enableSortingRemoval: false,
    meta: meta,
  });

  const handleNext = () => {
    if (pagination && pagination.page < pagination.pages) {
      onPageChange(pagination.page + 1);
    }
  };

  const handlePrevious = () => {
    if (pagination && pagination.page > 1) {
      onPageChange(pagination.page - 1);
    }
  };

  return (
    <div className="w-full">
      <div className="app-table-scroll">
        <Table className={tableClassName}>
          {!hideHeader && (
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {selection ? (
                    <TableHead className="app-table-head sticky top-0 z-[2] w-[44px] border-b border-separator pl-6 pr-0">
                      <Checkbox
                        checked={allRowsSelected}
                        onCheckedChange={selection.onToggleAll}
                        aria-label="Select every ticket on this page"
                        data-test={`${selectionPrefix}-select-all`}
                      />
                    </TableHead>
                  ) : null}
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    const content = header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext());
                    const SortIcon =
                      sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ChevronsUpDown;

                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={
                          sorted === 'asc'
                            ? 'ascending'
                            : sorted === 'desc'
                              ? 'descending'
                              : undefined
                        }
                        className={cn(
                          'app-table-head sticky top-0 z-[2] whitespace-nowrap border-b border-separator px-[5px] first:pl-6 last:pr-6',
                          header.column.columnDef.meta?.headerClassName || ''
                        )}
                      >
                        {canSort && content ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            data-test={`tickets-table-sort-${header.column.id}-button`}
                            className={cn(
                              'group inline-flex items-center gap-1.5 uppercase tracking-[0.07em] transition-colors hover:text-foreground',
                              sorted && 'text-foreground'
                            )}
                          >
                            {content}
                            {/* The idle chevrons only show on hover/focus: an arrow
                                on every header reads as "all of these are sorted". */}
                            <SortIcon
                              // Every sortable header carries its chevron, faint
                              // until it is the active sort — that is the mockup's
                              // affordance, and a hover-only arrow hides which
                              // columns can be sorted at all.
                              className={cn(
                                'h-3 w-3 shrink-0 transition-opacity',
                                sorted ? 'opacity-100' : 'opacity-35 group-hover:opacity-70'
                              )}
                              aria-hidden
                            />
                          </button>
                        ) : (
                          content
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
          )}

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const rowId = row.original.id ?? row.original._id;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="min-h-[46px] cursor-pointer border-b border-separator transition-colors hover:bg-accent/60"
                    data-test={`tickets-table-row-${rowId}-card`}
                    onClick={() => {
                      table.options.meta?.onRowClick?.(rowId, row.original);
                    }}
                  >
                    {selection ? (
                      // Its own click target, and it stops there: the row still
                      // opens the ticket, so ticking a box must not also open it.
                      <TableCell
                        className="app-table-cell w-[44px] pl-6 pr-0"
                        onClick={(event) => {
                          event.stopPropagation();
                          selection.onToggle(rowId);
                        }}
                      >
                        {/* Inert: the cell around it is the hit target, so the
                            box only reports the state. Handing the click to both
                            would toggle the row twice and leave it unchanged. */}
                        <Checkbox
                          checked={selection.selectedIds.has(rowId)}
                          onCheckedChange={() => selection.onToggle(rowId)}
                          aria-label={`Select ${row.original.subject || row.original.title || 'ticket'}`}
                          className="pointer-events-none"
                          data-test={`tickets-table-row-${rowId}-checkbox`}
                        />
                      </TableCell>
                    ) : null}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          // 5px a side, so two neighbouring cells make the
                          // mockup's 10px inter-column gap rather than 20px.
                          // The column widths in `ticketColumns` include this
                          // padding, which is what lands each column on the
                          // mockup's x position.
                          'app-table-cell px-[5px] first:pl-6 last:pr-6',
                          cell.column.columnDef.meta?.cellClassName || ''
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selection ? 1 : 0)}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-separator px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[12px] text-muted-foreground/75">
          Showing <span className="font-medium">{from}</span> to{' '}
          <span className="font-medium">{to}</span> of{' '}
          <span className="font-medium">{pagination?.total || 0}</span> results
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-[var(--r-control)]"
            onClick={handlePrevious}
            disabled={!pagination || pagination.page <= 1}
            data-test="tickets-table-pagination-prev-button"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-[var(--r-control)]"
            onClick={handleNext}
            disabled={!pagination || pagination.page >= pagination.pages}
            data-test="tickets-table-pagination-next-button"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
