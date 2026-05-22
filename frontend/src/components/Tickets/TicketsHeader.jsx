import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LayoutList, LayoutGrid, Plus } from 'lucide-react';
import PageHeading from '@/components/PageHeading';

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
  dataTestPrefix = 'tickets',
  title = 'Tickets',
  kicker = 'Workspace overview',
  subtitle,
  afterNewTicketSlot = null,
}) {
  return (
    <div className="app-page-content pb-0">
      <PageHeading
        kicker={kicker}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {!hideViewMode && (
              <div className="flex shrink-0 items-center rounded-2xl border border-border/80 bg-secondary/70 p-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('list')}
                  className="gap-2 rounded-xl"
                  data-test={`${dataTestPrefix}-view-list-button`}
                >
                  <LayoutList className="h-4 w-4" />
                  <span className="hidden sm:inline">List</span>
                </Button>
                <Button
                  variant={viewMode === 'board' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('board')}
                  className="gap-2 rounded-xl"
                  disabled={disableBoardView}
                  data-test={`${dataTestPrefix}-view-board-button`}
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
                data-test={`${dataTestPrefix}-search-input`}
              />
            </div>

            {!hideNewTicket && (
              <Button onClick={() => onNewTicket()} data-test={`${dataTestPrefix}-new-button`}>
                <Plus className="mr-2 h-4 w-4" />
                New ticket
              </Button>
            )}
          </>
        }
      >
        {afterNewTicketSlot}
      </PageHeading>
    </div>
  );
}
