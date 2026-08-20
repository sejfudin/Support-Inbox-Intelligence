import { LayoutGrid, LayoutList, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { Switcher } from '@/components/ui/switcher';
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
  crumb = 'Workspace',
  subtitle,
  afterNewTicketSlot = null,
}) {
  // List vs. board is the textbook switcher case: the same tickets, drawn a
  // second way. It used to be a hand-rolled segmented control at radius 9 with
  // 30px thumbs, one of the three separate builds of this the library replaces.
  const viewItems = [
    {
      value: 'list',
      label: 'List',
      icon: LayoutList,
      dataTest: `${dataTestPrefix}-view-list-button`,
    },
    {
      value: 'board',
      label: 'Board',
      icon: LayoutGrid,
      disabled: disableBoardView,
      dataTest: `${dataTestPrefix}-view-board-button`,
    },
  ];

  return (
    <div className="app-page-content pb-0">
      <PageHeading
        crumb={crumb}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {!hideViewMode && (
              <Switcher
                items={viewItems}
                value={viewMode}
                onChange={onViewModeChange}
                label="Ticket view"
                collapseLabels
              />
            )}

            {/* Search sits left of the primary action, at the same height as it. */}
            <SearchField
              ref={searchInputRef}
              value={search}
              onChange={onSearch}
              placeholder="Search tickets…"
              aria-label="Search tickets"
              className="w-full md:w-[240px]"
              data-test={`${dataTestPrefix}-search-input`}
            />

            {!hideNewTicket && (
              <Button onClick={() => onNewTicket()} data-test={`${dataTestPrefix}-new-button`}>
                <Plus className="h-3.5 w-3.5" />
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
