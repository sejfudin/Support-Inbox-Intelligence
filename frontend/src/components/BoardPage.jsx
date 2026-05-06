import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import AssigneesAvatar from './Tickets/AssigneesAvatar';
import PriorityIndicator from './PriorityIndicator';
import {
  BOARD_COLUMNS,
  STATUS_TO_COLUMN,
  STATUS_STYLES,
  COLUMN_TO_STATUS,
} from '../helpers/ticketStatus';
import { normalizeTicket } from '../helpers/normalizeTicket';
import { useTicketsInfinite } from '@/queries/tickets';

function TaskCard({ task, onOpen, cardClassName }) {
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
        className={`cursor-pointer border-2 bg-white/98 transition-all hover:-translate-y-0.5 hover:shadow-md ${cardClassName}`}
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

function BoardColumn({
  column,
  search,
  activeTab,
  queryFilters,
  workspaceId,
  onOpen,
  onColumnUpdate,
}) {
  const statusValue = COLUMN_TO_STATUS[column.id] || '';
  const style = STATUS_STYLES[column.id] ?? STATUS_STYLES.todo;

  const queryParams = useMemo(
    () => ({
      search,
      activeTab,
      status: statusValue,
      workspaceId,
      queryFilters,
      listLimit: 10,
    }),
    [search, activeTab, statusValue, workspaceId, queryFilters]
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useTicketsInfinite(queryParams);

  const tasks = useMemo(() => {
    return data?.pages.flatMap((page) => page.data.map((ticket) => normalizeTicket(ticket))) ?? [];
  }, [data]);

  useEffect(() => {
    onColumnUpdate(column.id, tasks);
  }, [column.id, tasks, onColumnUpdate]);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <Card
      ref={setNodeRef}
      className={`w-[320px] shrink-0 border-t-4 transition-all ${style.border} ${
        isOver ? 'bg-blue-50/60 scale-[1.01]' : 'bg-white/85'
      }`}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{column.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {data?.pages[0]?.pagination?.total ?? 0} tasks
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 min-h-[150px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={onOpen} cardClassName={style.card} />
          ))}
        </SortableContext>

        {hasNextPage && (
          <div className="pt-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const DEFAULT_FILTERS = {};
export default function BoardPage({
  workspaceId,
  onOpenTicket,
  onStatusChange,
  search = '',
  activeTab = 'all',
  queryFilters = DEFAULT_FILTERS,
}) {
  console.log('Current Search Prop:', search);
  const [activeTask, setActiveTask] = useState(null);
  const [columnsState, setColumnsState] = useState({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleColumnUpdate = useCallback((columnId, tasks) => {
    setColumnsState((prev) => ({ ...prev, [columnId]: tasks }));
  }, []);

  const handleDragStart = (event) => {
    const { active } = event;
    const allTasks = Object.values(columnsState).flat();
    const task = allTasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id;
    const sourceColumnId = Object.keys(columnsState).find((key) =>
      columnsState[key].some((t) => t.id === activeId)
    );

    let destinationColumnId = BOARD_COLUMNS.find((c) => c.id === over.id)?.id;
    if (!destinationColumnId) {
      destinationColumnId = Object.keys(columnsState).find((key) =>
        columnsState[key].some((t) => t.id === over.id)
      );
    }

    if (destinationColumnId && destinationColumnId !== sourceColumnId) {
      onStatusChange?.(activeId, destinationColumnId);
    }
  };

  return (
    <div className="app-page">
      <div className="app-page-content overflow-hidden pt-6">
        <div className="app-panel app-grid-bg overflow-hidden p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {BOARD_COLUMNS.map((column) => (
                  <BoardColumn
                    key={column.id}
                    column={column}
                    search={search}
                    activeTab={activeTab}
                    queryFilters={queryFilters}
                    workspaceId={workspaceId}
                    onOpen={onOpenTicket}
                    onColumnUpdate={handleColumnUpdate}
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
      </div>
    </div>
  );
}
