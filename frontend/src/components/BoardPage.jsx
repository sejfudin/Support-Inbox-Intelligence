import { useMemo, useState } from "react";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea, ScrollBar } from "../components/ui/scroll-area";
import { Plus } from "lucide-react";
import TicketsState from "./Tickets/TicketsState";
import AssigneesAvatar from "./Tickets/AssigneesAvatar";
import {
  BOARD_COLUMNS,
  STATUS_TO_COLUMN,
  COLUMN_TO_STATUS,
  STATUS_STYLES,
} from "../helpers/ticketStatus";
import { normalizeTicket } from "../helpers/normalizeTicket";

function TaskCard({ task, onOpen }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(task.id)}
      className="cursor-pointer hover:shadow-md transition-shadow"
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-snug line-clamp-2">
            {task.title}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <AssigneesAvatar users={task.assignedTo} />
        </div>
      </CardContent>
    </Card>
  );
}

function Column({ col, onOpen, onNewTicket }) {
  const style = STATUS_STYLES[col.id] ?? STATUS_STYLES.todo;

  return (
    <Card className={`w-[320px] shrink-0 border-t-4 ${style.border}`}>
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

          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => onNewTicket(COLUMN_TO_STATUS[col.id] || "to do")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {col.tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={onOpen} />
        ))}

        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => onNewTicket(COLUMN_TO_STATUS[col.id] || "to do")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add task
        </Button>
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
        due: normalized.dueDate
          ? new Date(normalized.dueDate).toLocaleDateString()
          : "",
        assignedTo: normalized.assignedTo,
        _raw: normalized.raw,
      };

      if (q && !task.title.toLowerCase().includes(q)) continue;

      byId[colId]?.tasks.push(task);
    }

    return base;
  }, [tickets, query]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto overflow-hidden px-4 py-6">
        <TicketsState
          isLoading={isLoading}
          isError={isError}
          isEmpty={!isLoading && !isError && columns.every((c) => c.tasks.length === 0)}
          emptyMessage="No tickets in the board."
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
        </TicketsState>
      </div>
    </div>
  );
}
