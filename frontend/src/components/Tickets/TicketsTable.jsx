import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataTable({ columns, data, pagination, onPageChange, meta }) {
  const [sorting, setSorting] = React.useState([]);
  const currentPage = pagination?.page || 1;
  const totalResults = pagination?.total || 0;
  const limit = pagination?.limit || 10; 

  const from = totalResults === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to = Math.min(currentPage * limit, totalResults);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    manualPagination: true,
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
      <div className="w-full overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4 align-top">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-sm text-gray-600">
          Showing{" "}
          <span className="font-medium">
            {from}
          </span>{" "}
          to{" "}
          <span className="font-medium">
            {to}         
          </span>{" "}
          of <span className="font-medium">{pagination?.total || 0}</span> results
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrevious}
            disabled={!pagination || pagination.page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleNext}
            disabled={!pagination || pagination.page >= pagination.pages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}