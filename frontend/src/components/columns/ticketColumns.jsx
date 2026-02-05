import { TicketStatusBadge } from "../StatusBadge";
import AssigneesAvatar from "../Tickets/AssigneesAvatar";

export const columns = [
  {
    accessorKey: "title",
    header: "SUBJECT",
    meta: {
      headerClassName: "w-[58%]",
      cellClassName: "w-[58%]",
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
      headerClassName: "w-[14%]",
      cellClassName: "w-[14%] whitespace-nowrap",
    },
    cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "assignedTo",
    header: "ASSIGNED TO",
    meta: {
      headerClassName: "w-[14%]",
      cellClassName: "w-[14%] whitespace-nowrap",
    },
    cell: ({ row }) => <AssigneesAvatar users={row.original.assignedTo} />,
  },
  {
    accessorKey: "action",
    header: "ACTION",
    meta: {
      headerClassName: "w-[14%]",
      cellClassName: "w-[14%] whitespace-nowrap",
    },
    cell: ({ row, table }) => {
      const ticketId = row.original.id ?? row.original._id;

      return (
        <button
          type="button"
          onClick={() => table.options.meta?.onOpenTicket?.(ticketId)}
          className="text-blue-600 hover:underline font-medium cursor-pointer"
        >
          View
        </button>
      );
    },
  },
];
