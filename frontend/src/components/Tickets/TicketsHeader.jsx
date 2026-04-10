import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutList, LayoutGrid, Plus } from "lucide-react";

export default function TicketsHeader({
  viewMode,
  onViewModeChange,
  search,
  onSearch,
  onNewTicket,
  searchInputRef,
  hideViewMode = false,
  disableBoardView = false,
  hideNewTicket = false,
  title = "Tickets",
}) {
  return (
    <div className="app-page-content pb-0">
      <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <div className="app-kicker mb-3">Workspace overview</div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center md:w-auto">
          {!hideViewMode && (
            <div className="flex items-center rounded-2xl border border-border/80 bg-secondary/70 p-1 shrink-0">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("list")}
                className="gap-2 rounded-xl"
              >
                <LayoutList className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </Button>
              <Button
                variant={viewMode === "board" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("board")}
                className="gap-2 rounded-xl"
                disabled={disableBoardView}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Board</span>
              </Button>
            </div>
          )}

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search tickets..."
              className="pl-9"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label="Search tickets"
            />
          </div>

          {!hideNewTicket && (
            <Button onClick={() => onNewTicket()}>
              <Plus className="mr-2 h-4 w-4" />
              New task
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
