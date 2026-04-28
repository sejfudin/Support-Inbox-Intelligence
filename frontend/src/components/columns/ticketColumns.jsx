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
import StoryPointsIndicator from "../StoryPointsIndicator";

export function createTicketColumns() {
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
        headerClassName: "w-[36%]",
        cellClassName: "w-[36%]",
      },
      cell: ({ row }) => {
        const stripHtml = (html) => {
          if (!html) return "";
          
          const spacedHtml = html
            .replace(/</g, " <")
            .replace(/>/g, "> ")
            .replace(/\s+/g, " ");
          
          const tmp = document.createElement("div");
          tmp.innerHTML = spacedHtml;
          
          const text = tmp.textContent || tmp.innerText || "";
          return text.replace(/\s+/g, " ").trim();
        };
        const plainDescription = stripHtml(row.original.description);

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
              title={plainDescription}
            >
              {plainDescription}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "STATUS",
      meta: {
        headerClassName: "w-[10%]",
        cellClassName: "w-[10%] whitespace-nowrap",
      },
      cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "priority",
      header: "PRIORITY",
      meta: {
        headerClassName: "w-[10%]",
        cellClassName: "w-[10%] whitespace-nowrap",
      },
      cell: ({ row }) => <PriorityIndicator priority={row.original.priority} />,
    },
    {
      accessorKey: "dueDate",
      header: "DUE DATE",
      meta: {
        headerClassName: "w-[11%]",
        cellClassName: "w-[11%] whitespace-nowrap",
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
      accessorKey: "storyPoints",
      header: "SP",
      meta: {
        headerClassName: "w-[7%]",
        cellClassName: "w-[7%] whitespace-nowrap",
      },
      cell: ({ row }) => <StoryPointsIndicator value={row.original.storyPoints} />,
    },
    {
      accessorKey: "totalTimeSpent",
      header: "TIME SPENT",
      meta: {
        headerClassName: "w-[9%]",
        cellClassName:
          "w-[9%] whitespace-nowrap font-medium text-gray-500 text-xs",
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
        headerClassName: "w-[12%]",
        cellClassName: "w-[12%] whitespace-nowrap",
      },
      cell: ({ row }) => <AssigneesAvatar users={row.original.assignedTo} />,
    },
  ];
}

export const columns = createTicketColumns();
