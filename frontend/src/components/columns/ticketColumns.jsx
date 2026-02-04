import { Link } from "react-router-dom";
import { Avatar } from "../Avatar";
import { TicketStatusBadge } from "../StatusBadge";

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
    accessorKey: "creator",
    header: "Creator",
    cell: ({ row }) => (
      <div className="text-sm">
        {row.original.creator?.email || "Unassigned"}
      </div>
    ),
  },
  {
    accessorKey: "assignedTo",
    header: "ASSIGNED TO",
    cell: ({ row }) => <Avatar users={row.original.assignedTo} />,
  },
  {
    accessorKey: "action",
    header: "ACTION",
    cell: ({ row }) => {
      const ticketId = row.original._id || row.original.id;
      return (
        <Link 
          to={`/tickets/${ticketId}`} 
          className="text-blue-600 hover:underline"
        >
          View
        </Link>
      );
    },
  },
];