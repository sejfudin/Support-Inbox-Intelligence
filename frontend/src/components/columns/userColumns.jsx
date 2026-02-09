import { RoleBadge } from "../RoleBadge";
import { UserStatusBadge } from "../UserStatusBadge";

export const columns = [
    {
      accessorKey: "user",
      header: "USER",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">
            {row.original.user}
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
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: "status",
      header: "STATUS",
      cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "action",
      header: "ACTION",
      cell: ({ row, table }) => (
        <button
          onClick={() => table.options.meta?.onEditUser?.(row.original)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          Edit
        </button>
      ),
    },
  ];