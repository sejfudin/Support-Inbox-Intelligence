import TicketStatusBadge from "../StatusBadge";
import AssigneesAvatar from "../Tickets/AssigneesAvatar";

export const columns = [
  {
    accessorKey: "taskNumber",
    header: "ID", 
    meta: {
      headerClassName: "w-[8%]",
      cellClassName: "w-[8%] font-medium text-muted-foreground",
    },
    cell: ({ row }) => {
      const taskNumber = row.original.taskNumber;
      return taskNumber ? `${taskNumber}` : "-";
    },
  },
  {
    accessorKey: "title",
    header: "SUBJECT",
    meta: {
      headerClassName: "w-[50%]", 
      cellClassName: "w-[50%]",
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
  }
];