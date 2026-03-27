import TicketStatusBadge  from "../StatusBadge";
import AssigneesAvatar from "../Tickets/AssigneesAvatar";

export const columns = [
  {
    accessorKey: "title",
    header: "SUBJECT",
    meta: {
      headerClassName: "w-[58%]",
      cellClassName: "w-[58%]",
    },
   cell: ({ row }) => {

      const taskNumber = row.original.taskNumber;
      return (
        <div className="flex flex-col w-full min-w-0 max-w-full gap-1">
          <div 
            className="truncate font-semibold text-foreground" 
            title={`${taskNumber ? `#${taskNumber} ` : ""}${row.original.title}`}
          >
            {taskNumber ? `#${taskNumber} ${row.original.title}` : row.original.title}
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
