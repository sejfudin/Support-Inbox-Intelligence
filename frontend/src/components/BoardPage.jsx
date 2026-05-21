import { useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import TicketsState from './Tickets/TicketsState';
import AssigneesAvatar from './Tickets/AssigneesAvatar';
import PriorityIndicator from './PriorityIndicator';
import BoardSkeleton from './Skeletons/BoardSkeleton';
import { getColumnStyle } from '../helpers/ticketStatus';
import { normalizeTicket } from '../helpers/normalizeTicket';
import { cn } from '../lib/utils';

function TaskCard({ task, onOpen, cardClassName, cardStyle }) {
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
      <Card
        role="button"
        tabIndex={0}
        onClick={() => onOpen(task.id)}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(task.id)}
        className={cn(
          'cursor-pointer border-2 bg-card transition-all hover:-translate-y-0.5',
          cardClassName
        )}
        style={cardStyle}
      >
        <CardContent className="p-3">
          {task.taskNumber && (
            <div className="flex justify-between items-center mb-2">
              <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-black text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">
                {task.taskNumber}
              </span>
            </div>
          )}

          <p className="font-semibold text-sm leading-tight text-foreground line-clamp-2">
            {task.title}
          </p>

          <div className="mt-3 flex items-center justify-between border-t border-separator pt-2">
            <PriorityIndicator priority={task.priority} />
            <AssigneesAvatar users={task.assignedTo} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Column({ col, onOpen, onNewTicket, boardHelpers }) {
  const style = getColumnStyle(boardHelpers, col.id);

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
        'w-[320px] shrink-0 border-border/50 bg-card shadow-elevated-sm border-t-4 transition-all duration-300 ease-in-out',
        isDroppingOver &&
          'scale-[1.02] bg-blue-500/10 ring-4 ring-blue-500/25 shadow-lg z-10 dark:bg-blue-500/15 dark:ring-blue-400/30'
      )}
      style={{ borderTopColor: style.borderTopColor }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{col.title}</CardTitle>
            </div>

            <p className="text-xs text-muted-foreground">{col.tasks.length} tasks</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 min-h-[150px]">
        <SortableContext items={col.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {col.tasks.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={onOpen} cardStyle={style.cardStyle} />
          ))}
        </SortableContext>
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
  const [query, setQuery] = useState('');
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const columns = useMemo(() => {
    if (!boardHelpers?.boardColumns?.length) return [];

    const base = boardHelpers.boardColumns.map((c) => ({ ...c, tasks: [] }));
    const byId = Object.fromEntries(base.map((c) => [c.id, c]));
    const q = query.trim().toLowerCase();

    for (const t of tickets) {
      const normalized = normalizeTicket(t);
      const colId = boardHelpers.resolveBoardColumnId(normalized.status);

      const task = {
        id: normalized.id,
        title: normalized.title,
        priority: normalized.priority,
        due: normalized.dueDate ? new Date(normalized.dueDate).toLocaleDateString() : '',
        assignedTo: normalized.assignedTo,
        taskNumber: normalized.taskNumber,
        status: colId,
        _raw: normalized.raw,
      };

      if (q && !task.title.toLowerCase().includes(q)) continue;
      if (byId[colId]) byId[colId].tasks.push(task);
    }
    return base;
  }, [tickets, query, boardHelpers]);

  function handleDragStart(event) {
    const { active } = event;
    const task = tickets.find((t) => t.id === active.id);
    if (task) setActiveTask(normalizeTicket(task));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeTicket = tickets.find((t) => t.id === activeId);
    if (!activeTicket) return;

    const normalizedActive = normalizeTicket(activeTicket);
    const currentColumnId = boardHelpers?.resolveBoardColumnId(normalizedActive.status);

    let destinationColumnId = null;

    const overColumn = boardHelpers?.boardColumns.find((c) => c.id === overId);

    if (overColumn) {
      destinationColumnId = overColumn.id;
    } else {
      const targetCol = columns.find((col) => col.tasks.some((t) => t.id === overId));
      if (targetCol) {
        destinationColumnId = targetCol.id;
      }
    }

    if (destinationColumnId && destinationColumnId !== currentColumnId) {
      onStatusChange?.(activeId, destinationColumnId);
    }
  }

  return (
    <div className={flush ? 'w-full' : 'app-page'}>
      <div
        className={cn(flush ? 'w-full overflow-hidden' : 'app-page-content overflow-hidden pt-6')}
      >
        <TicketsState
          isLoading={isLoading}
          isError={isError}
          isEmpty={!isLoading && !isError && columns.every((c) => c.tasks.length === 0)}
          emptyMessage="No tickets in the board."
          loadingSlot={<BoardSkeleton />}
        >
          <div className="app-panel app-grid-bg overflow-hidden p-4">
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {columns.map((c) => (
                    <Column
                      key={c.id}
                      col={c}
                      onOpen={onOpenTicket}
                      onNewTicket={onNewTicket}
                      boardHelpers={boardHelpers}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {createPortal(
                <DragOverlay dropAnimation={null}>
                  {activeTask ? (
                    <TaskCard
                      task={activeTask}
                      cardClassName="shadow-2xl border-blue-500 cursor-grabbing"
                    />
                  ) : null}
                </DragOverlay>,
                document.body
              )}
            </DndContext>
          </div>
        </TicketsState>
      </div>
    </div>
  );
}
