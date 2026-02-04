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

const demoData = [
  {
    id: "todo",
    title: "To do",
    tasks: [
      { id: "t1", title: "Auth UI", priority: "high", due: "Feb 10" },
      {
        id: "t2",
        title: "Navbar responsive",
        priority: "medium",
        due: "Feb 12",
      },
    ],
  },
  {
    id: "inprogress",
    title: "In progress",
    tasks: [
      { id: "t3", title: "Board layout", priority: "low", due: "Feb 08" },
    ],
  },
  {
    id: "done",
    title: "Done",
    tasks: [
      { id: "t4", title: "Project setup", priority: "low", due: "Feb 05" },
    ],
  },
];

function PriorityBadge({ p }) {
  const classes = {
    low: "bg-muted text-foreground border-muted-foreground/20",
    medium: "bg-amber-100 text-amber-900 border-amber-200",
    high: "bg-rose-100 text-rose-900 border-rose-200",
  };

  return (
    <Badge variant="outline" className={`capitalize ${classes[p] ?? ""}`}>
      {p}
    </Badge>
  );
}

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
          <PriorityBadge p={task.priority} />
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
  return (
    <Card className="w-[320px] shrink-0">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{col.title}</CardTitle>
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
                {task?.priority && <PriorityBadge p={task.priority} />}
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

export default function BoardPage() {
  const [query, setQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);

  const columns = useMemo(() => {
    if (!query.trim()) return demoData;
    const q = query.toLowerCase();
    return demoData.map((c) => ({
      ...c,
      tasks: c.tasks.filter((t) => t.title.toLowerCase().includes(q)),
    }));
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      {/* Board */}
      <div className="mx-auto max-w-6xl px-4 py-6">
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
