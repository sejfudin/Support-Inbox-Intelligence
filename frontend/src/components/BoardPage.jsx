import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { format } from 'date-fns';
import { Loader2, Plus } from 'lucide-react';

import { PR_STATE_CONFIG } from '@/components/PRCard';
import PriorityIndicator from '@/components/PriorityIndicator';
import AssigneesAvatar from '@/components/Tickets/AssigneesAvatar';
import BlockedByChip from '@/components/Tickets/BlockedByChip';
import BoardSkeleton from '@/components/Skeletons/BoardSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { getColumnStyle } from '@/helpers/ticketStatus';
import { sortBoardTasksByPriorityOrder } from '@/helpers/boardTicketsQuery';
import { normalizeTicket } from '@/helpers/normalizeTicket';
import { cn } from '@/lib/utils';
import { useBoardColumnTickets } from '@/queries/boardTickets';

function formatDueLabel(dueDate) {
  if (!dueDate) return '';
  try {
    const d = dueDate instanceof Date ? dueDate : new Date(dueDate);
    if (Number.isNaN(d.getTime())) return '';
    return format(d, 'MMM d, yyyy');
  } catch {
    return '';
  }
}

function buildBoardTaskView(ticket, boardHelpers) {
  const normalized = normalizeTicket(ticket);
  const colId = boardHelpers.resolveBoardColumnId(normalized.status);
  const category = ticket.category;
  const categoryLabel =
    category && typeof category === 'object' ? String(category.name || '').trim() : '';

  return {
    id: normalized.id,
    title: normalized.title,
    priority: normalized.priority,
    dueLabel: formatDueLabel(normalized.dueDate),
    assignedTo: normalized.assignedTo,
    taskNumber: normalized.taskNumber,
    storyPoints: normalized.storyPoints,
    categoryLabel,
    linkedPullRequest: ticket.linkedPullRequest || null,
    blockingTicket: ticket.blockedBy?.ticket || null,
    columnId: colId,
    updatedAt: ticket.updatedAt ?? null,
  };
}

const BoardTaskCardBody = memo(function BoardTaskCardBody({
  task,
  onOpen,
  cardClassName,
  cardStyle,
  compact = false,
}) {
  const pr = task.linkedPullRequest;
  const prLabel = pr && typeof pr === 'object' && pr.prNumber != null ? `#${pr.prNumber}` : '';
  const prStateConfig = pr?.state ? PR_STATE_CONFIG[pr.state] : null;
  const PrStateIcon = prStateConfig?.icon;
  const hasStoryPoints = task.storyPoints != null && task.storyPoints !== '';

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(task.id)}
      data-test={`board-task-${task.id}-card`}
      className={cn(
        'cursor-pointer border-2 border-border/80 bg-card text-card-foreground shadow-sm',
        !compact &&
          'transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md',
        cardClassName
      )}
      style={cardStyle}
    >
      <CardContent className="p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {task.taskNumber != null && task.taskNumber !== '' && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-black text-primary">
              {task.taskNumber}
            </span>
          )}
          {hasStoryPoints ? (
            <span className="rounded border border-border/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {task.storyPoints} pts
            </span>
          ) : null}
          {prLabel && prStateConfig ? (
            <Badge
              variant="outline"
              className={cn(
                'h-5 gap-0.5 border px-1.5 text-[10px] font-normal',
                prStateConfig.className
              )}
            >
              {PrStateIcon ? <PrStateIcon className="h-3 w-3" aria-hidden /> : null}
              {prLabel}
            </Badge>
          ) : null}
          {/* `onOpen` is "open ticket details for this id", so the chip reuses it
              to open the blocker. It stops the click reaching the card itself. */}
          <BlockedByChip blocker={task.blockingTicket} onOpenTicket={onOpen} />
        </div>

        <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
          {task.title}
        </p>

        {task.categoryLabel ? (
          <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{task.categoryLabel}</p>
        ) : null}

        {task.dueLabel ? (
          <p className="mt-1 text-xs text-muted-foreground">Due {task.dueLabel}</p>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
          <PriorityIndicator priority={task.priority} />
          <AssigneesAvatar users={task.assignedTo} emptyDisplay="avatar" />
        </div>
      </CardContent>
    </Card>
  );
});

const DraggableBoardTaskCard = memo(function DraggableBoardTaskCard({
  task,
  columnId,
  onOpen,
  cardStyle,
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task, columnId },
  });

  return (
    <div
      ref={setNodeRef}
      data-test={`board-task-${task.id}-drag`}
      className={cn('touch-none select-none', isDragging && 'opacity-40')}
      {...listeners}
      {...attributes}
    >
      <BoardTaskCardBody task={task} onOpen={onOpen} cardStyle={cardStyle} compact={isDragging} />
    </div>
  );
});

const BoardColumn = memo(function BoardColumn({
  col,
  fetchMode,
  workspaceId,
  search,
  queryFilters,
  enabled,
  onOpen,
  onNewTicketInColumn,
  boardHelpers,
  flush = false,
  isBoardDragging = false,
}) {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const style = getColumnStyle(boardHelpers, col.id);
  const columnStatusId = boardHelpers.resolveStatusFromColumnId(col.id);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isFetching, isError } =
    useBoardColumnTickets({
      columnStatusId: col.id,
      fetchMode,
      workspaceId,
      search,
      queryFilters,
      enabled,
    });

  const tasks = useMemo(() => {
    const pages = data?.pages || [];
    const merged = pages.flatMap((page) =>
      (page?.data || []).map((ticket) => buildBoardTaskView(ticket, boardHelpers))
    );
    return sortBoardTasksByPriorityOrder(merged, queryFilters.priorityOrder);
  }, [data?.pages, boardHelpers, queryFilters.priorityOrder]);

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const isColumnLoading = isLoading || (isFetching && tasks.length === 0);
  const totalCount = isColumnLoading ? null : (data?.pages?.[0]?.pagination?.total ?? tasks.length);

  const { setNodeRef, isOver } = useDroppable({
    id: col.id,
  });

  useEffect(() => {
    if (isBoardDragging) return undefined;

    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasNextPage) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root, rootMargin: '120px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isBoardDragging,
    taskIds.length,
    search,
    queryFilters,
  ]);

  return (
    <Card
      ref={setNodeRef}
      data-test={`board-column-${col.id}-drop`}
      className={cn(
        'flex w-[320px] shrink-0 flex-col border-border/50 bg-card shadow-elevated-sm border-t-4 transition-all duration-300 ease-in-out',
        flush ? 'h-full max-h-full min-h-0' : 'max-h-[min(96vh,calc(100vh-10rem))]',
        isOver &&
          'z-10 scale-[1.02] border-primary/40 bg-primary/5 shadow-lg ring-4 ring-primary/25'
      )}
      style={{ borderTopColor: style.borderTopColor }}
    >
      <CardHeader className="shrink-0 space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{col.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {isColumnLoading ? 'Loading…' : `${totalCount ?? tasks.length} tasks`}
            </p>
          </div>
          {columnStatusId && onNewTicketInColumn ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              aria-label={`New ticket in ${col.title}`}
              onClick={() => onNewTicketInColumn(columnStatusId)}
              data-test={`board-column-${col.id}-new-button`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
        <div ref={scrollRef} className="min-h-[120px] flex-1 space-y-3 overflow-y-auto pr-1">
          {isError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 py-6 text-center text-xs text-destructive">
              Failed to load tickets.
            </p>
          ) : null}

          {isColumnLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-md border p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : null}

          {!isColumnLoading && !isError && tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 py-8 text-center text-xs text-muted-foreground">
              Drop tickets here
            </p>
          ) : null}

          {!isColumnLoading && !isError
            ? tasks.map((task) => (
                <DraggableBoardTaskCard
                  key={task.id}
                  task={task}
                  columnId={col.id}
                  onOpen={onOpen}
                  cardStyle={style.cardStyle}
                />
              ))
            : null}

          {isFetchingNextPage ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
              <span className="sr-only">Loading more tickets</span>
            </div>
          ) : null}

          <div ref={sentinelRef} className="h-1 shrink-0" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
});

export default function BoardPage({
  fetchMode = 'all',
  workspaceId,
  search = '',
  queryFilters = {},
  enabled = true,
  statusesLoading = false,
  onNewTicket,
  onOpenTicket,
  onStatusChange,
  boardHelpers,
  flush = false,
}) {
  const [activeTaskView, setActiveTaskView] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const columns = boardHelpers?.boardColumns || [];
  const isBoardDragging = activeTaskView != null;

  const handleDragStart = useCallback((event) => {
    const payload = event.active.data.current;
    if (payload?.task) setActiveTaskView(payload.task);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveTaskView(null);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveTaskView(null);

      if (!over || !boardHelpers) return;

      const sourceColumnId = active.data.current?.columnId;
      const destinationColumnId = boardHelpers.boardColumns.some((column) => column.id === over.id)
        ? over.id
        : (over.data.current?.columnId ?? null);

      if (destinationColumnId && destinationColumnId !== sourceColumnId) {
        onStatusChange?.(active.id, destinationColumnId);
      }
    },
    [boardHelpers, onStatusChange]
  );

  if (statusesLoading || !boardHelpers?.hasStatuses) {
    return (
      <div
        className={cn(
          'w-full',
          flush ? 'flex h-full min-h-0 flex-1 flex-col' : 'flex min-h-0 flex-1 flex-col'
        )}
      >
        <BoardSkeleton />
      </div>
    );
  }

  const columnRow = (
    <div className={cn('flex gap-4 pb-4', flush && 'h-full min-h-0 items-stretch')}>
      {columns.map((col) => (
        <BoardColumn
          key={col.id}
          col={col}
          fetchMode={fetchMode}
          workspaceId={workspaceId}
          search={search}
          queryFilters={queryFilters}
          enabled={enabled}
          onOpen={onOpenTicket}
          onNewTicketInColumn={onNewTicket}
          boardHelpers={boardHelpers}
          flush={flush}
          isBoardDragging={isBoardDragging}
        />
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        'w-full',
        flush ? 'flex h-full min-h-0 flex-1 flex-col' : 'flex min-h-0 flex-1 flex-col'
      )}
    >
      <div
        className={cn(
          'app-panel flex min-h-0 flex-1 flex-col overflow-hidden p-4',
          flush ? 'h-full' : 'min-h-[calc(100vh-9rem)]'
        )}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          {flush ? (
            <div className="h-full min-h-0 w-full flex-1 overflow-x-auto overflow-y-hidden">
              {columnRow}
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-9rem)] min-h-0 w-full flex-1">
              {columnRow}
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}

          <DragOverlay dropAnimation={null}>
            {activeTaskView ? (
              <div className="pointer-events-none w-[288px] cursor-grabbing touch-none will-change-transform">
                <BoardTaskCardBody
                  task={activeTaskView}
                  onOpen={() => {}}
                  cardClassName="shadow-lg ring-2 ring-primary/20"
                  compact
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
