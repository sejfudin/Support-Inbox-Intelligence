import { RoleBadge } from "../RoleBadge";
import { UserStatusBadge } from "../UserStatusBadge";

export const columns = [
  {
    accessorKey: "user",
    header: "USER",
    meta: {
      headerClassName: "w-[60%]",
      cellClassName: "w-[60%]",
    },
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-semibold text-foreground">
          {row.original.fullName || row.original.user}
        </span>
        <span className="text-xs text-muted-foreground">
          {row.original.email}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "ROLE",
    meta: {
      headerClassName: "w-[20%]",
      cellClassName: "w-[20%] whitespace-nowrap",
    },
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
  },
  {
    accessorKey: "status",
    header: "STATUS",
    meta: {
      headerClassName: "w-[20%]",
      cellClassName: "w-[20%] whitespace-nowrap",
    },
    cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
  }
];