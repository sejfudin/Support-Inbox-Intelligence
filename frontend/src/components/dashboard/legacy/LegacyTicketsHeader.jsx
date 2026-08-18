/**
 * FROZEN — the pre-overhaul ticket list, kept byte-for-byte from the commit before
 * the UI overhaul and used by `UserDashboard` alone.
 *
 * The dashboards are explicitly out of the overhaul's scope and have to render
 * exactly as they did; the list they embed is shared with Tickets/Archive/Backlog,
 * which the overhaul does change. Rather than branch the shared components on a
 * prop — which the next person would quietly re-couple — the old version lives
 * here, once, and nothing else imports it.
 *
 * Do not "tidy" this file: any edit here is a change to a dashboard.
 */
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LayoutList, LayoutGrid, Plus } from 'lucide-react';
import LegacyPageHeading from '@/components/dashboard/legacy/LegacyPageHeading';

export default function LegacyTicketsHeader({
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
      <LegacyPageHeading
        kicker={kicker}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {!hideViewMode && (
              <div className="flex shrink-0 items-center rounded-[var(--r-card)] border border-border/80 bg-secondary/70 p-1">
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
      </LegacyPageHeading>
    </div>
  );
}
