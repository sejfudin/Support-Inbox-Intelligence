import { format } from 'date-fns';
import { ArchiveRestore, MessageSquare } from 'lucide-react';
import TicketStatusBadge from '../StatusBadge';
import PriorityIndicator from '../PriorityIndicator';
import AssigneesAvatar from '../Tickets/AssigneesAvatar';
import { formatDuration } from '../../helpers/formatDuration';
import { formatDueDateDisplay, isDueDateOverdue } from '../../helpers/ticketDueDate';
import { getTicketTimeSpentSeconds, isTicketTrackingTime } from '../../helpers/ticketTimeSpent';
import { cn } from '@/lib/utils';
import { isSortableTicketColumn } from '@/helpers/ticketSort';
import StoryPointsIndicator from '../StoryPointsIndicator';
import BlockedByChip from '../Tickets/BlockedByChip';
import TicketReviewChip from '../Tickets/TicketReviewChip';

const stripHtml = (html) => {
  if (!html) return '';
  const spacedHtml = html.replace(/</g, ' <').replace(/>/g, '> ').replace(/\s+/g, ' ');
  const tmp = document.createElement('div');
  tmp.innerHTML = spacedHtml;
  const text = tmp.textContent || tmp.innerText || '';
  return text.replace(/\s+/g, ' ').trim();
};

const formatDayLabel = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, 'MMM d, yyyy');
};

const DayCell = ({ value }) => {
  const label = formatDayLabel(value);
  return (
    <span className="text-[12.5px] text-muted-foreground">{label || <span>&mdash;</span>}</span>
  );
};

export function createTicketColumns({
  statusBadgeConfig = {},
  statusIsDone,
  statusTracksTime,
  variant = 'default',
  onRestore,
  onOpenTicket,
  hiddenColumns = [],
} = {}) {
  // Column order and content widths are the mockup's: 56 · 1fr(min 180) · 116 ·
  // 100 · 150 · 44 · 92, over an 840px floor. The widths below are those plus the
  // 5px cell padding each side (24px on the outer edge), because the mockup lays
  // this out as a grid with a 10px `gap` while the table carries that space as
  // cell padding. Add the two the naive way and every column right of SUBJECT
  // drifts ~70px off the mockup. Time spent is not in the mockup's grid and is
  // hidden by the ticket list; it stays defined for the callers that ask for it.
  const columns = [
    {
      accessorKey: 'taskNumber',
      header: 'ID',
      meta: {
        headerClassName: 'w-[85px]',
        cellClassName: 'w-[85px] text-[12px] tabular-nums text-muted-foreground/75',
      },
      cell: ({ row }) => {
        const taskNumber = row.original.taskNumber;
        return taskNumber ? `#${taskNumber}` : '';
      },
    },
    {
      accessorKey: 'title',
      header: 'SUBJECT',
      meta: {
        headerClassName: 'min-w-[180px]',
        cellClassName: 'min-w-[180px]',
      },
      cell: ({ row }) => {
        const statusColor = statusBadgeConfig[row.original.status]?.color;
        const comments = row.original.commentCount;

        return (
          <div className="flex min-w-0 items-center gap-[9px]">
            {statusColor ? (
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ backgroundColor: statusColor }}
                aria-hidden
              />
            ) : null}
            <span
              className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground"
              title={row.original.title}
            >
              {row.original.title}
            </span>
            {/* Sits with the title rather than in its own column: it is a fact
                about this ticket's title row, and a column would be blank for
                almost every ticket on the board. */}
            <BlockedByChip
              blocker={row.original.blockedBy?.ticket}
              onOpenTicket={onOpenTicket}
              className="shrink-0"
            />
            <TicketReviewChip reviewRequest={row.original.reviewRequest} className="shrink-0" />
            {comments > 0 ? (
              <span className="flex shrink-0 items-center gap-[3px] text-[11px] text-muted-foreground/75">
                <MessageSquare className="h-3 w-3" aria-hidden />
                {comments}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'STATUS',
      meta: {
        headerClassName: 'w-[126px]',
        cellClassName: 'w-[126px] whitespace-nowrap',
      },
      cell: ({ row }) => (
        <TicketStatusBadge status={row.original.status} statusBadgeConfig={statusBadgeConfig} />
      ),
    },
    {
      accessorKey: 'priority',
      header: 'PRIORITY',
      meta: {
        headerClassName: 'w-[110px]',
        cellClassName: 'w-[110px] whitespace-nowrap',
      },
      cell: ({ row }) => <PriorityIndicator priority={row.original.priority} size="list" />,
    },
    {
      accessorKey: 'assignedTo',
      header: 'ASSIGNED TO',
      meta: {
        headerClassName: 'w-[160px]',
        cellClassName: 'w-[160px] whitespace-nowrap',
      },
      cell: ({ row }) => <AssigneesAvatar users={row.original.assignedTo} size="xs" withName />,
    },
    {
      accessorKey: 'storyPoints',
      header: 'SP',
      meta: {
        headerClassName: 'w-[54px] text-center',
        cellClassName: 'w-[54px] text-center whitespace-nowrap',
      },
      // Plain secondary text, not a bold foreground number: in the mockup SP is a
      // reference value in the numeric block with the due date, not a metric.
      cell: ({ row }) => <StoryPointsIndicator value={row.original.storyPoints} tone="list" />,
    },
    {
      accessorKey: 'dueDate',
      header: 'DUE DATE',
      meta: {
        headerClassName: 'w-[121px]',
        cellClassName: 'w-[121px] whitespace-nowrap',
      },
      cell: ({ row }) => {
        const due = row.original.dueDate;
        const label = formatDueDateDisplay(due);
        const overdue = isDueDateOverdue(due, row.original.status, statusIsDone);

        if (!label) return <span className="text-[12.5px] text-muted-foreground/75">—</span>;

        return (
          <span
            className={cn(
              'text-[12.5px]',
              overdue ? 'font-medium text-[hsl(var(--tone-danger-fg))]' : 'text-muted-foreground'
            )}
            title={overdue ? 'Overdue' : undefined}
          >
            {label}
          </span>
        );
      },
    },
    {
      accessorKey: 'totalTimeSpent',
      enableSorting: false,
      header: 'TIME SPENT',
      meta: {
        headerClassName: 'w-[92px]',
        cellClassName: 'w-[92px] whitespace-nowrap text-[12.5px] text-muted-foreground',
      },
      cell: ({ row }) => {
        const seconds = getTicketTimeSpentSeconds(row.original, statusTracksTime);
        const isTracking = isTicketTrackingTime(row.original, statusTracksTime);

        if (seconds === 0) return <span className="text-muted-foreground">-</span>;

        return (
          <div className="flex items-center gap-1">
            {formatDuration(seconds)}
            {isTracking && (
              <span className="h-1 w-1 animate-pulse rounded-full bg-[hsl(var(--tone-info))]" />
            )}
          </div>
        );
      },
    },
  ];

  const visibleColumns = hiddenColumns.length
    ? columns.filter((col) => !hiddenColumns.includes(col.accessorKey))
    : columns;

  const baseColumn = (accessorKey) => columns.find((column) => column.accessorKey === accessorKey);

  // On a server-sorted list a header the API cannot order is a dead control: the
  // click lands, nothing moves. Status and assignee are the two the tickets API
  // has no sort for, so those headers stay plain text there.
  const withApiSorting = (column) => ({
    ...column,
    enableSorting:
      column.enableSorting !== false && isSortableTicketColumn(column.id ?? column.accessorKey),
  });

  const createdAtColumn = {
    accessorKey: 'createdAt',
    sortDescFirst: true,
    header: 'CREATED',
    meta: {
      headerClassName: 'w-[121px]',
      cellClassName: 'w-[121px] whitespace-nowrap',
    },
    cell: ({ row }) => <DayCell value={row.original.createdAt} />,
  };

  if (variant === 'archive') {
    // The archive is asked "what did we archive recently" before anything else,
    // and the single full-width summary row it used to render had no headers to
    // ask that of. Same column grid as the ticket list instead, so `DataTable`'s
    // sortable headers drive it; the description snippet moves under the subject.
    const archiveColumns = [
      baseColumn('taskNumber'),
      {
        ...baseColumn('title'),
        cell: ({ row }) => {
          const ticket = row.original;
          const snippet = stripHtml(ticket.description);

          return (
            <div className="min-w-0">
              <div
                className="truncate text-[13px] font-medium text-foreground"
                title={ticket.title}
              >
                {ticket.title}
              </div>
              {snippet && (
                <div className="line-clamp-1 text-[12px] text-muted-foreground" title={snippet}>
                  {snippet}
                </div>
              )}
            </div>
          );
        },
      },
      baseColumn('priority'),
      baseColumn('storyPoints'),
      {
        accessorKey: 'archivedAt',
        sortDescFirst: true,
        header: 'ARCHIVED',
        meta: {
          headerClassName: 'w-[132px]',
          cellClassName: 'w-[132px] whitespace-nowrap',
        },
        cell: ({ row }) => <DayCell value={row.original.archivedAt} />,
      },
    ];

    // Same guard the backlog variant uses: every one of the five above is
    // API-orderable today, so this changes nothing now — it is here so a column
    // added later that the API cannot sort arrives as plain text rather than as a
    // header that swallows the click.
    const sortableArchiveColumns = archiveColumns.map(withApiSorting);

    if (!onRestore) return sortableArchiveColumns;

    return [
      ...sortableArchiveColumns,
      {
        id: 'restore',
        enableSorting: false,
        header: '',
        meta: {
          headerClassName: 'w-[116px]',
          cellClassName: 'w-[116px] whitespace-nowrap text-right',
        },
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRestore(row.original);
            }}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-control)] border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            title="Restore ticket"
            data-test="archive-row-restore"
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restore</span>
          </button>
        ),
      },
    ];
  }

  if (variant === 'backlog') {
    // Backlog tickets have not been worked, so TIME SPENT is "-" on every row.
    // The width it frees goes to CREATED — how long a ticket has sat untriaged is
    // the question this list is actually read for.
    return [
      ...visibleColumns
        .filter((column) => column.accessorKey !== 'totalTimeSpent')
        .map(withApiSorting),
      createdAtColumn,
    ];
  }

  return visibleColumns;
}

export const columns = createTicketColumns();
