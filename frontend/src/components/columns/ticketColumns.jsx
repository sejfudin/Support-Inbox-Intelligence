import TicketStatusBadge from "../StatusBadge";
import PriorityIndicator from "../PriorityIndicator";
import AssigneesAvatar from "../Tickets/AssigneesAvatar";
import { formatDuration } from "../../helpers/formatDuration";
import StoryPointsIndicator from "../StoryPointsIndicator";

export const columns = [
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
      headerClassName: "w-[53%]",
      cellClassName: "w-[53%]",
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
      headerClassName: "w-[12%] !pl-1 pr-4",
      cellClassName: "w-[10%] !pl-1 pr-4 whitespace-nowrap",
   },
    cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "priority",
    header: "PRIORITY",
    meta: {
      headerClassName: "w-[12%] !pl-1 pr-4",
      cellClassName: "w-[10%] !pl-1 pr-4 whitespace-nowrap",
    },
    cell: ({ row }) => <PriorityIndicator priority={row.original.priority} />,
  },
  {
    accessorKey: "storyPoints",
    header: "STORY POINTS",
    meta: {
      headerClassName: "w-[14%] !pl-1 pr-6",
      cellClassName: "w-[10%] !pl-1 pr-4 whitespace-nowrap",
    },
    cell: ({ row }) => <StoryPointsIndicator value={row.original.storyPoints} />,
  },
  {
    accessorKey: "totalTimeSpent",
    header: "TIME SPENT",
    meta: {
      headerClassName: "w-[12%] !pl-1 pr-4",
      cellClassName: "w-[10%] !pl-1 pr-4 whitespace-nowrap",
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
      headerClassName: "w-[12%] !pl-1 pr-4",
      cellClassName: "w-[10%] !pl-1 pr-4  whitespace-nowrap",
    },
    cell: ({ row }) => <AssigneesAvatar users={row.original.assignedTo} />,
  },
];