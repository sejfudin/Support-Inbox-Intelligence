import TicketStatusBadge from "../StatusBadge";
import AssigneesAvatar from "../Tickets/AssigneesAvatar";
import { formatDuration } from "../../helpers/formatDuration";

export const columns = [
  {
    accessorKey: "title",
    header: "SUBJECT",
    meta: {
      headerClassName: "w-[66%]",
      cellClassName: "w-[66%]",
    },
    cell: ({ row }) => (
      <div className="w-full min-w-0 max-w-full">
        <div
          className="truncate font-semibold text-foreground"
          title={row.original.title}
        >
          {row.original.title}
        </div>
        <div
          className="mt-1 line-clamp-1 text-sm text-muted-foreground break-words"
          title={row.original.description}
        >
          {row.original.description}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "STATUS",
    meta: {
      headerClassName: "w-[12%]",
      cellClassName: "w-[12%] whitespace-nowrap",
    },
    cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
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
      headerClassName: "w-[12%]",
      cellClassName: "w-[12%] whitespace-nowrap",
    },
    cell: ({ row }) => <AssigneesAvatar users={row.original.assignedTo} />,
  },
];
