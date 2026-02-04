import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';

const getStatusBadge = (status) => {
  const variants = {
    open: "destructive",
    pending: "warning",
    closed: "success",
  };
  return (
    <Badge variant={variants[status]} className="capitalize">
      {status}
    </Badge>
  );
};

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
    accessorKey: "customer",
    header: "CUSTOMER",
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-foreground">
          {row.original.customer?.name}
        </div>
        <div className="text-sm text-muted-foreground">
          {row.original.customer?.email}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "STATUS",
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
  {
    accessorKey: "creator",
    header: "AGENT",
    cell: ({ row }) => (
      <div className="text-sm">
        {row.original.creator?.fullName || "Unassigned"}
      </div>
    ),
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