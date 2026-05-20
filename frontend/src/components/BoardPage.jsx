import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

import { PR_STATE_CONFIG } from '@/components/PRCard';
import PriorityIndicator from '@/components/PriorityIndicator';
import AssigneesAvatar from '@/components/Tickets/AssigneesAvatar';
import BoardSkeleton from '@/components/Skeletons/BoardSkeleton';
import TicketsState from '@/components/Tickets/TicketsState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getColumnStyle } from '@/helpers/ticketStatus';
import { normalizeTicket } from '@/helpers/normalizeTicket';
import { cn } from '@/lib/utils';

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

/** Board receives list items shaped by normalizeTicket(); use .raw when present for full API fields. */
function ticketSourceDoc(ticket) {
  return ticket?.raw ?? ticket;
}

function buildBoardTaskView(ticket, boardHelpers) {
  const source = ticketSourceDoc(ticket);
  const normalized = normalizeTicket(source);
  const raw = source;
  const colId = boardHelpers.resolveBoardColumnId(normalized.status);
  const category = raw.category;
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
    linkedPullRequest: raw.linkedPullRequest || null,
    columnId: colId,
  };
}

function BoardTaskCardBody({ task, onOpen, cardClassName, cardStyle }) {
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
      className={cn(
        'cursor-pointer border-2 border-border/80 bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5',
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
          <AssigneesAvatar users={task.assignedTo} />
        </div>
      </CardContent>
    </Card>
  );
}

function SortableBoardTaskCard({ task, onOpen, cardStyle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BoardTaskCardBody task={task} onOpen={onOpen} cardStyle={cardStyle} />
    </div>
  );
}

function Column({ col, onOpen, onNewTicketInColumn, boardHelpers }) {
  const style = getColumnStyle(boardHelpers, col.id);
  const columnStatusId = boardHelpers.resolveStatusFromColumnId(col.id);

  const { setNodeRef, isOver, over } = useDroppable({
    id: col.id,
  });

  const isDroppingOver = useMemo(() => {
    if (isOver) return true;
    if (!over) return false;
    return col.tasks.some((t) => t.id === over.id);
  }, [isOver, over, col.tasks]);

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'flex max-h-[min(96vh,calc(100vh-10rem))] w-[320px] shrink-0 flex-col border-border/70 bg-card/90 border-t-4 transition-all duration-300 ease-in-out',
        isDroppingOver && 'z-10 scale-[1.02] bg-primary/5 shadow-lg ring-4 ring-primary/15'
      )}
      style={{ borderTopColor: style.borderTopColor }}
    >
      <CardHeader className="shrink-0 space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{col.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{col.tasks.length} tasks</p>
          </div>
          {columnStatusId && onNewTicketInColumn ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              aria-label={`New ticket in ${col.title}`}
              onClick={() => onNewTicketInColumn(columnStatusId)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
        <div className="min-h-[120px] flex-1 space-y-3 overflow-y-auto pr-1">
          {col.tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 py-8 text-center text-xs text-muted-foreground">
              Drop tickets here
            </p>
          ) : null}
          <SortableContext
            items={col.tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {col.tasks.map((t) => (
              <SortableBoardTaskCard
                key={t.id}
                task={t}
                onOpen={onOpen}
                cardStyle={style.cardStyle}
              />
            ))}
          </SortableContext>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BoardPage({
  tickets = [],
  isLoading,
  isError,
  onNewTicket,
  onOpenTicket,
  onStatusChange,
  boardHelpers,
  flush = false,
}) {
  const [activeTaskView, setActiveTaskView] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const columns = useMemo(() => {
    if (!boardHelpers?.boardColumns?.length) return [];

    const base = boardHelpers.boardColumns.map((c) => ({ ...c, tasks: [] }));
    const byId = Object.fromEntries(base.map((c) => [c.id, c]));

    for (const t of tickets) {
      const view = buildBoardTaskView(t, boardHelpers);
      if (byId[view.columnId]) byId[view.columnId].tasks.push(view);
    }
    return base;
  }, [tickets, boardHelpers]);

  function handleDragStart(event) {
    const { active } = event;
    const ticket = tickets.find((item) => item.id === active.id);
    if (ticket && boardHelpers) setActiveTaskView(buildBoardTaskView(ticket, boardHelpers));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveTaskView(null);

    if (!over || !boardHelpers) return;

    const activeId = active.id;

    const activeTicket = tickets.find((item) => item.id === activeId);
    if (!activeTicket) return;

    const normalizedActive = normalizeTicket(ticketSourceDoc(activeTicket));
    const currentColumnId = boardHelpers.resolveBoardColumnId(normalizedActive.status);

    let destinationColumnId = null;

    const overColumn = boardHelpers.boardColumns.find((c) => c.id === over.id);

    if (overColumn) {
      destinationColumnId = overColumn.id;
    } else {
      const targetCol = columns.find((col) => col.tasks.some((task) => task.id === over.id));
      if (targetCol) {
        destinationColumnId = targetCol.id;
      }
    }

    if (destinationColumnId && destinationColumnId !== currentColumnId) {
      onStatusChange?.(activeId, destinationColumnId);
    }
  }

  return (
    <div className={cn('w-full', flush ? '' : 'flex min-h-0 flex-1 flex-col')}>
      <TicketsState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!isLoading && !isError && columns.every((c) => c.tasks.length === 0)}
        emptyMessage="No tickets in the board."
        loadingSlot={<BoardSkeleton />}
      >
        <div
          className={cn(
            'app-panel overflow-hidden p-4',
            flush ? 'min-h-[calc(100vh-12rem)]' : 'min-h-[calc(100vh-9rem)]'
          )}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea
              className={cn('w-full', flush ? 'h-[calc(100vh-13rem)]' : 'h-[calc(100vh-9rem)]')}
            >
              <div className="flex gap-4 pb-4">
                {columns.map((c) => (
                  <Column
                    key={c.id}
                    col={c}
                    onOpen={onOpenTicket}
                    onNewTicketInColumn={onNewTicket}
                    boardHelpers={boardHelpers}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {createPortal(
              <DragOverlay dropAnimation={null}>
                {activeTaskView ? (
                  <div className="cursor-grabbing">
                    <BoardTaskCardBody
                      task={activeTaskView}
                      onOpen={() => {}}
                      cardClassName="shadow-2xl border-primary ring-2 ring-primary/20"
                    />
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
        </div>
      </TicketsState>
    </div>
  );
}
