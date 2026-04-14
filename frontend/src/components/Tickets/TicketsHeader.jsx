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
  afterNewTicketSlot = null,
}) {
  return (
    <div className="app-page-content pb-0">
      <div className="app-panel px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="app-kicker mb-3">Workspace overview</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center md:w-auto">
            {!hideViewMode && (
              <div className="shrink-0 flex items-center rounded-2xl border border-border/80 bg-secondary/70 p-1">
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

        {afterNewTicketSlot ? (
          <div className="mt-3 border-t border-border/60 pt-3">
            {afterNewTicketSlot}
          </div>
        ) : null}
      </div>
    </div>
  );
}
  