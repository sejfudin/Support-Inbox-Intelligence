import { useMemo, useState } from "react";

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
  return (
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
  );
}

function Column({ col, onOpen, onNewTicket }) {
  const style = STATUS_STYLES[col.id] ?? STATUS_STYLES.todo;

  return (
    <Card className={`w-[320px] shrink-0 border-white/70 bg-white/85 ${style.border} border-t-4`}>
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

      <CardContent className="space-y-3 pt-0">
        {col.tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={onOpen} cardClassName={style.card} />
        ))}
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
}) {
  const [query, setQuery] = useState("");

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
        due: normalized.dueDate
          ? new Date(normalized.dueDate).toLocaleDateString()
          : "",
        assignedTo: normalized.assignedTo,
        taskNumber: normalized.taskNumber,
        _raw: normalized.raw,
      };

      if (q && !task.title.toLowerCase().includes(q)) continue;

      byId[colId]?.tasks.push(task);
    }

    return base;
  }, [tickets, query]);

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
          </div>
        </TicketsState>
      </div>
    </div>
  );
}
