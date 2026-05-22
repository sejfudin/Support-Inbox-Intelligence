import { RoleBadge } from '../RoleBadge';
import { UserStatusBadge } from '../UserStatusBadge';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

export const columns = [
  {
    accessorKey: 'user',
    header: 'USER',
    meta: {
      headerClassName: 'w-[52%]',
      cellClassName: 'w-[52%]',
    },
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-semibold text-foreground">
          {row.original.fullName || row.original.user}
        </span>
        <span className="text-xs text-muted-foreground">{row.original.email}</span>
      </div>
    ),
  },
  {
    accessorKey: 'role',
    header: 'ROLE',
    meta: {
      headerClassName: 'w-[18%]',
      cellClassName: 'w-[18%] whitespace-nowrap',
    },
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
  },
  {
    accessorKey: 'status',
    header: 'STATUS',
    meta: {
      headerClassName: 'w-[18%]',
      cellClassName: 'w-[18%] whitespace-nowrap',
    },
    cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
  },
  {
    id: 'actions',
    header: 'ACTIONS',
    meta: {
      headerClassName: 'w-[12%]',
      cellClassName: 'w-[12%] whitespace-nowrap',
    },
    cell: ({ row, table }) => (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          table.options.meta?.onRowClick?.(row.original.id, row.original);
        }}
        data-test={`admin-users-row-${row.original.id}-edit-button`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    ),
  },
];
