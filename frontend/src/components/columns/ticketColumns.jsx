import { TicketStatusBadge } from "../StatusBadge";
import { Avatar } from "../Avatar";

export const columns = [
  {
    accessorKey: "subject",
    header: "SUBJECT",
    cell: ({ row }) => (
      <div className="max-w-md">
        <div className="font-semibold text-foreground">
          {row.original.subject}
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
    cell: ({ row }) => <Avatar users={row.original.assignedTo} />,
  },
  {
    accessorKey: "action",
    header: "ACTION",
    cell: ({ row, table }) => {
      const ticketId = row.original._id ?? row.original.id;

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
