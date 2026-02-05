import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutList, LayoutGrid, Plus } from "lucide-react";

export default function TicketsHeader({
  viewMode,
  onViewModeChange,
  search,
  onSearch,
  onNewTicket,
}) {
  return (
    <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
      <h1 className="text-xl font-bold sm:text-2xl">Inbox</h1>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
        <div className="flex items-center border rounded-lg p-1 shrink-0">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("list")}
            className="gap-2"
          >
            <LayoutList className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </Button>
          <Button
            variant={viewMode === "board" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("board")}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Board</span>
          </Button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tickets..."
            className="pl-9"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        <Button onClick={() => onNewTicket()}>
          <Plus className="h-4 w-4 mr-2" />
          New task
        </Button>
      </div>
    </div>
  );
}
