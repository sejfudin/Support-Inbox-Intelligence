import { TicketStatusBadge } from "../StatusBadge";
import AssigneesAvatar from "../Tickets/AssigneesAvatar";

export const columns = [
  {
    accessorKey: "title",
    header: "SUBJECT",
    cell: ({ row }) => (
      <div className="max-w-md">
        <div className="font-semibold text-foreground">
          {row.original.title}
        </div>
        <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
          {row.original.description}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "STATUS",
    cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "assignedTo",
    header: "ASSIGNED TO",
    cell: ({ row }) => <AssigneesAvatar users={row.original.assignedTo} />,
  },
  {
    accessorKey: "action",
    header: "ACTION",
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
