import TicketStatusBadge from "../StatusBadge";
import PriorityIndicator from "../PriorityIndicator";
import AssigneesAvatar from "../Tickets/AssigneesAvatar";
import { formatDuration } from "../../helpers/formatDuration";
import {
  formatDueDateDisplay,
  isDueDateOverdue,
} from "../../helpers/ticketDueDate";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * @param {{ sortBy?: string, sortOrder?: string, onDueDateSort?: () => void }} [options]
 */
export function createTicketColumns({
  sortBy = "dueDate",
  sortOrder = "desc",
  onDueDateSort,
} = {}) {
  const dueDateHeader =
    typeof onDueDateSort === "function" ? (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 font-semibold tracking-[0.18em] text-muted-foreground hover:text-foreground"
        title={
          sortOrder === "desc"
            ? "Sorted by due date: latest first — click for earliest first"
            : "Sorted by due date: earliest first — click for latest first"
        }
        aria-label={
          sortOrder === "desc"
            ? "Due date column, latest first. Click to sort earliest first."
            : "Due date column, earliest first. Click to sort latest first."
        }
        onClick={(e) => {
          e.stopPropagation();
          onDueDateSort();
        }}
      >
        DUE DATE
        {sortOrder === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
        )}
      </button>
    ) : (
      "DUE DATE"
    );

  return [
    {
      accessorKey: "taskNumber",
      header: "ID",
      meta: {
        headerClassName: "w-[5%]",
        cellClassName: "w-[5%] font-medium text-muted-foreground",
      },
      cell: ({ row }) => {
        const taskNumber = row.original.taskNumber;
        return taskNumber ? `${taskNumber}` : "";
      },
    },
    {
      accessorKey: "title",
      header: "SUBJECT",
      meta: {
        headerClassName: "w-[44%]",
        cellClassName: "w-[44%]",
      },
      cell: ({ row }) => {
        return (
          <div className="flex flex-col w-full min-w-0 max-w-full gap-1">
            <div
              className="truncate font-semibold text-foreground"
              title={row.original.title}
            >
              {row.original.title}
            </div>
            <div
              className="line-clamp-1 text-sm text-muted-foreground break-words"
              title={row.original.description}
            >
              {row.original.description}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "STATUS",
      meta: {
        headerClassName: "w-[11%]",
        cellClassName: "w-[11%] whitespace-nowrap",
      },
      cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "priority",
      header: "PRIORITY",
      meta: {
        headerClassName: "w-[11%]",
        cellClassName: "w-[11%] whitespace-nowrap",
      },
      cell: ({ row }) => <PriorityIndicator priority={row.original.priority} />,
    },
    {
      accessorKey: "dueDate",
      header: dueDateHeader,
      meta: {
        headerClassName: "w-[12%]",
        cellClassName: "w-[12%] whitespace-nowrap",
      },
      cell: ({ row }) => {
        const due = row.original.dueDate;
        const label = formatDueDateDisplay(due);
        const overdue = isDueDateOverdue(due, row.original.status);

        if (!label) {
          return <span className="text-muted-foreground/60">—</span>;
        }

        return (
          <div className="flex flex-col gap-1">
       <span
              className={cn(
                "text-xs",
                overdue
                  ? "font-semibold text-destructive"
                  : "font-medium text-foreground",
              )}
            >
              {label}
            </span>
            {overdue && (
              <Badge
                variant="destructive"
                className="w-fit px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide"
              >
                Overdue
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "totalTimeSpent",
      header: "TIME SPENT",
      meta: {
        headerClassName: "w-[10%]",
        cellClassName:
          "w-[10%] whitespace-nowrap font-medium text-gray-500 text-xs",
      },
      cell: ({ row }) => {
        let seconds = row.original.totalTimeSpent || 0;

        if (
          row.original.status?.toLowerCase() === "in progress" &&
          row.original.inProgressAt
        ) {
          const now = new Date();
          const inProgressAt = new Date(row.original.inProgressAt);
          seconds += Math.max(0, Math.floor((now - inProgressAt) / 1000));
        }

        if (seconds === 0) return <span className="text-gray-300">-</span>;

        return (
          <div className="flex items-center gap-1">
            {formatDuration(seconds)}
            {row.original.status?.toLowerCase() === "in progress" && (
              <span className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "assignedTo",
      header: "ASSIGNED TO",
      meta: {
        headerClassName: "w-[11%]",
        cellClassName: "w-[11%] whitespace-nowrap",
      },
      cell: ({ row }) => <AssigneesAvatar users={row.original.assignedTo} />,
    },
  ];
}

export const columns = createTicketColumns();
