import { format } from 'date-fns';
import { ArchiveRestore } from 'lucide-react';
import TicketStatusBadge from '../StatusBadge';
import PriorityIndicator from '../PriorityIndicator';
import AssigneesAvatar from '../Tickets/AssigneesAvatar';
import { formatDuration } from '../../helpers/formatDuration';
import { formatDueDateDisplay, isDueDateOverdue } from '../../helpers/ticketDueDate';
import { getTicketTimeSpentSeconds, isTicketTrackingTime } from '../../helpers/ticketTimeSpent';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import StoryPointsIndicator from '../StoryPointsIndicator';

const stripHtml = (html) => {
  if (!html) return '';
  const spacedHtml = html.replace(/</g, ' <').replace(/>/g, '> ').replace(/\s+/g, ' ');
  const tmp = document.createElement('div');
  tmp.innerHTML = spacedHtml;
  const text = tmp.textContent || tmp.innerText || '';
  return text.replace(/\s+/g, ' ').trim();
};

export function createTicketColumns({
  statusBadgeConfig = {},
  statusIsDone,
  statusTracksTime,
  variant = 'default',
  onRestore,
  hiddenColumns = [],
} = {}) {
  const columns = [
    {
      accessorKey: 'taskNumber',
      header: 'ID',
      meta: {
        headerClassName: 'w-[5%]',
        cellClassName: 'w-[5%] align-middle font-medium text-muted-foreground',
      },
      cell: ({ row }) => {
        const taskNumber = row.original.taskNumber;
        return taskNumber ? `${taskNumber}` : '';
      },
    },
    {
      accessorKey: 'title',
      header: 'SUBJECT',
      meta: {
        headerClassName: 'w-[36%]',
        cellClassName: 'w-[36%]',
      },
      cell: ({ row }) => {
        const plainDescription = stripHtml(row.original.description);
        const statusColor = statusBadgeConfig[row.original.status]?.color;

        return (
          <div className="flex flex-col w-full min-w-0 max-w-full gap-1">
            <div
              className="flex items-center gap-2 truncate font-semibold text-foreground"
              title={row.original.title}
            >
              {statusColor ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: statusColor }}
                />
              ) : null}
              <span className="truncate">{row.original.title}</span>
            </div>
            <div
              className="line-clamp-1 text-sm text-muted-foreground break-words"
              title={plainDescription}
            >
              {plainDescription}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'STATUS',
      meta: {
        headerClassName: 'w-[10%]',
        cellClassName: 'w-[10%] whitespace-nowrap',
      },
      cell: ({ row }) => (
        <TicketStatusBadge status={row.original.status} statusBadgeConfig={statusBadgeConfig} />
      ),
    },
    {
      accessorKey: 'priority',
      header: 'PRIORITY',
      meta: {
        headerClassName: 'w-[10%]',
        cellClassName: 'w-[10%] align-middle whitespace-nowrap',
      },
      cell: ({ row }) => <PriorityIndicator priority={row.original.priority} />,
    },
    {
      accessorKey: 'dueDate',
      header: 'DUE DATE',
      meta: {
        headerClassName: 'w-[11%]',
        cellClassName: 'w-[11%] align-middle whitespace-nowrap',
      },
      cell: ({ row }) => {
        const due = row.original.dueDate;
        const label = formatDueDateDisplay(due);
        const overdue = isDueDateOverdue(due, row.original.status, statusIsDone);

        if (!label) {
          return <span className="text-sm text-muted-foreground/60">—</span>;
        }

        return (
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                'text-sm',
                overdue ? 'font-semibold text-destructive' : 'font-medium text-foreground'
              )}
            >
              {label}
            </span>
            {overdue && (
              <Badge
                variant="destructive"
                className="w-fit px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide"
              >
                Overdue
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'storyPoints',
      header: 'SP',
      meta: {
        headerClassName: 'w-[7%]',
        cellClassName: 'w-[7%] align-middle whitespace-nowrap',
      },
      cell: ({ row }) => <StoryPointsIndicator value={row.original.storyPoints} />,
    },
    {
      accessorKey: 'totalTimeSpent',
      header: 'TIME SPENT',
      meta: {
        headerClassName: 'w-[9%]',
        cellClassName: 'w-[9%] whitespace-nowrap font-medium text-muted-foreground text-xs',
      },
      cell: ({ row }) => {
        const seconds = getTicketTimeSpentSeconds(row.original, statusTracksTime);
        const isTracking = isTicketTrackingTime(row.original, statusTracksTime);

        if (seconds === 0) return <span className="text-muted-foreground">-</span>;

        return (
          <div className="flex items-center gap-1">
            {formatDuration(seconds)}
            {isTracking && <span className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />}
          </div>
        );
      },
    },
    {
      accessorKey: 'assignedTo',
      header: 'ASSIGNED TO',
      meta: {
        headerClassName: 'w-[12%]',
        cellClassName: 'w-[12%] align-middle whitespace-nowrap',
      },
      cell: ({ row }) => <AssigneesAvatar users={row.original.assignedTo} />,
    },
  ];

  const visibleColumns = hiddenColumns.length
    ? columns.filter((col) => !hiddenColumns.includes(col.accessorKey))
    : columns;

  if (variant === 'archive') {
    // Sparse, scan-to-restore data: render each ticket as one full-width row
    // (identity + archive date + restore) rather than a column grid.
    return [
      {
        id: 'summary',
        header: '',
        cell: ({ row }) => {
          const ticket = row.original;
          const snippet = stripHtml(ticket.description);
          let archivedLabel = null;
          if (ticket.archivedAt) {
            try {
              archivedLabel = format(new Date(ticket.archivedAt), 'MMM d, yyyy');
            } catch {
              archivedLabel = null;
            }
          }

          return (
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 shrink-0 text-xs font-semibold text-muted-foreground">
                  #{ticket.taskNumber ?? '—'}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground" title={ticket.title}>
                    {ticket.title}
                  </div>
                  {snippet && (
                    <div className="line-clamp-1 text-sm text-muted-foreground" title={snippet}>
                      {snippet}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                <div className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                  {archivedLabel ? `Archived ${archivedLabel}` : '—'}
                </div>

                {onRestore && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRestore(ticket);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                    title="Restore ticket"
                    data-test="archive-row-restore"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Restore</span>
                  </button>
                )}
              </div>
            </div>
          );
        },
      },
    ];
  }

  return visibleColumns;
}

export const columns = createTicketColumns();
