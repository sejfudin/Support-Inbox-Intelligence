import { useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DndContext, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, defaultDropAnimationSideEffects } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea, ScrollBar } from "../components/ui/scroll-area";
import TicketsState from "./Tickets/TicketsState";
import AssigneesAvatar from "./Tickets/AssigneesAvatar";
import PriorityIndicator from "./PriorityIndicator";
import BoardSkeleton from "./Skeletons/BoardSkeleton";
import {
  BOARD_COLUMNS,
  STATUS_TO_COLUMN,
  STATUS_STYLES,
} from "../helpers/ticketStatus";
import { normalizeTicket } from "../helpers/normalizeTicket";

function TaskCard({ task, onOpen, cardClassName }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

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
        onKeyDown={(e) => e.key === "Enter" && onOpen(task.id)}
        className={`cursor-pointer border-2 bg-white/98 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-24px_rgba(108,105,255,0.55)] ${cardClassName}`}
      >
      <CardContent className="p-3">
        {task.taskNumber && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-blue-600/70 bg-blue-50 px-1.5 py-0.5 rounded">
              {task.taskNumber}
            </span>
          </div>
        )}
        
        <p className="font-semibold text-sm leading-tight text-slate-800 line-clamp-2">
          {task.title}
        </p>

        <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between">
          <PriorityIndicator priority={task.priority} />
          <AssigneesAvatar users={task.assignedTo} />
        </div>
      </CardContent>
      </Card>
    </div>
  );
}

function Column({ col, onOpen, onNewTicket }) {
  const style = STATUS_STYLES[col.id] ?? STATUS_STYLES.todo;

  const { setNodeRef, isOver } = useDroppable({
    id: col.id, 
  });

  return (
    <Card ref={setNodeRef} className={`w-[320px] shrink-0 border-white/70 bg-white/85 ${style.border} border-t-4 transition-all duration-200 ${
        isOver ? "bg-blue-50/50 ring-2 ring-blue-400/20 scale-[1.01]" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{col.title}</CardTitle>
            </div>

            <p className="text-xs text-muted-foreground">
              {col.tasks.length} tasks
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 min-h-[150px]">
        <SortableContext 
          items={col.tasks.map(t => t.id)} 
          strategy={verticalListSortingStrategy}
        >
        {col.tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={onOpen} cardClassName={style.card} />
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
}) {
  const [query, setQuery] = useState("");
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const columns = useMemo(() => {
    const base = BOARD_COLUMNS.map((c) => ({ ...c, tasks: [] }));
    const byId = Object.fromEntries(base.map((c) => [c.id, c]));
    const q = query.trim().toLowerCase();

    for (const t of tickets) {
      const normalized = normalizeTicket(t);
      const dbStatus = (normalized.status || "open").toLowerCase();
      const colId = STATUS_TO_COLUMN[dbStatus] || "todo";

      const task = {
        id: normalized.id,
        title: normalized.title,
        priority: normalized.priority,
        due: normalized.dueDate ? new Date(normalized.dueDate).toLocaleDateString() : "",
        assignedTo: normalized.assignedTo,
        taskNumber: normalized.taskNumber,
        status: colId,
        _raw: normalized.raw,
      };

      if (q && !task.title.toLowerCase().includes(q)) continue;
      if (byId[colId]) byId[colId].tasks.push(task);
    }
    return base;
  }, [tickets, query]);

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

    const activeTicket = tickets.find(t => t.id === activeId);
    if (!activeTicket) return;

    const normalizedActive = normalizeTicket(activeTicket);
    const currentStatus = (normalizedActive.status || "open").toLowerCase();
    const currentColumnId = STATUS_TO_COLUMN[currentStatus] || "todo";

    let destinationColumnId = null;

    const overColumn = BOARD_COLUMNS.find(c => c.id === overId);
    
    if (overColumn) {
      destinationColumnId = overColumn.id;
    } else {
      const targetCol = columns.find(col => 
        col.tasks.some(t => t.id === overId)
      );
      if (targetCol) {
        destinationColumnId = targetCol.id;
      }
    }

    if (destinationColumnId && destinationColumnId !== currentColumnId) {
      console.log(`Prebacujem task ${activeId} iz ${currentColumnId} u ${destinationColumnId}`);
      onStatusChange?.(activeId, destinationColumnId);
    }
  }

  return (
    <div className="app-page">
      <div className="app-page-content overflow-hidden pt-6">
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