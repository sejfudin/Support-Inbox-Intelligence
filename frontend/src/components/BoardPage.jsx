import { useMemo, useState } from "react";

import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { ScrollArea, ScrollBar } from "../components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

import { Plus, Search, X } from "lucide-react";

export const STATUS_STYLES = {
  todo: {
    pill: "bg-slate-50 text-slate-600",
    border: "border-slate-300",
  },
  inprogress: {
    pill: "bg-blue-50 text-blue-600",
    border: "border-blue-300",
  },
  blocked: {
    pill: "bg-red-50 text-red-600",
    border: "border-red-300",
  },
  staging: {
    pill: "bg-purple-50 text-purple-600",
    border: "border-purple-300",
  },
  done: {
    pill: "bg-green-50 text-green-600",
    border: "border-green-300",
  },
};

const demoData = [
  {
    id: "todo",
    title: "To do",
    tasks: [
      { id: "t1", title: "Auth UI", due: "Feb 10" },
      {
        id: "t2",
        title: "Navbar responsive",
        due: "Feb 12",
      },
    ],
  },
  {
    id: "inprogress",
    title: "In progress",
    tasks: [{ id: "t3", title: "Board layout", due: "Feb 08" }],
  },
  {
    id: "blocked",
    title: "Blocked",
    tasks: [{ id: "t4", title: "Project setup", due: "Feb 05" }],
  },
  {
    id: "staging",
    title: "On Staging",
    tasks: [{ id: "t4", title: "Project setup", due: "Feb 05" }],
  },
  {
    id: "done",
    title: "Done",
    tasks: [{ id: "t4", title: "Project setup", due: "Feb 05" }],
  },
];

function AvatarCircle({ letter = "T" }) {
  return (
    <div className="h-7 w-7 rounded-full bg-foreground text-background grid place-items-center text-xs font-semibold">
      {letter}
    </div>
  );
}

function TaskCard({ task, onOpen }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(task)}
      className="cursor-pointer hover:shadow-md transition-shadow"
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-snug line-clamp-2">
            {task.title}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Due: {task.due}</span>
          <AvatarCircle letter="T" />
        </div>
      </CardContent>
    </Card>
  );
}

function Column({ col, onOpen }) {
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

          <Button size="icon" variant="outline" className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {col.tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={onOpen} />
        ))}

        <Button variant="outline" className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-2" />
          Add task
        </Button>
      </CardContent>
    </Card>
  );
}

function TaskModal({ task, onClose }) {
  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl">{task?.title}</DialogTitle>
              <DialogDescription className="mt-2 flex flex-wrap items-center gap-2">
                {task?.due && <span className="text-sm">Due: {task.due}</span>}
              </DialogDescription>
            </div>

            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold mb-2">Description</p>
            <div className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
              UI-only modal. Plug real description + assignee + comments later.
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Comments</p>
            <div className="space-y-2">
              <div className="rounded-xl border p-3 text-sm">
                Looks good — add drag & drop next.
              </div>
              <div className="rounded-xl border p-3 text-sm">
                Add filters by assignee & priority.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button>Save (UI)</Button>
            <Button variant="outline">Delete (UI)</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BoardPage({ tickets = [], isLoading, isError }) {
  const [query, setQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);

  // Map DB statuses -> your UI column IDs
  // Adjust these strings to match your DB values!
  const STATUS_TO_COLUMN = {
    open: "todo",
    pending: "inprogress",
    blocked: "blocked",
    staging: "staging",
    done: "done",
    closed: "done",
  };

  const columns = useMemo(() => {
    // Base columns (same as your demoData columns)
    const base = [
      { id: "todo", title: "To do", tasks: [] },
      { id: "inprogress", title: "In progress", tasks: [] },
      { id: "blocked", title: "Blocked", tasks: [] },
      { id: "staging", title: "On Staging", tasks: [] },
      { id: "done", title: "Done", tasks: [] },
    ];

    const byId = Object.fromEntries(base.map((c) => [c.id, c]));

    const q = query.trim().toLowerCase();

    for (const t of tickets) {
      const dbStatus = (t.status || "open").toLowerCase();
      const colId = STATUS_TO_COLUMN[dbStatus] || "todo";

      // keep UI task shape the same as before
      const task = {
        id: t._id || t.id,
        title: t.title || t.subject || t.name || "Untitled",
        due: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : t.due || "",
        // keep original ticket if you want later
        _raw: t,
      };

      // optional search filter (same behavior you had)
      if (q && !task.title.toLowerCase().includes(q)) continue;

      byId[colId]?.tasks.push(task);
    }

    return base;
  }, [tickets, query]);

  // Optional: keep your page looking the same but show basic states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto overflow-hidden px-4 py-6">
          <div className="flex items-center justify-center h-64 font-medium text-gray-500">
            Loading tickets...
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto overflow-hidden px-4 py-6">
          <div className="flex items-center justify-center h-64 text-red-500">
            Something went wrong.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Board */}
      <div className="mx-auto overflow-hidden px-4 py-6">
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {columns.map((c) => (
              <Column key={c.id} col={c} onOpen={setSelectedTask} />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
