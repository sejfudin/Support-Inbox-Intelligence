import React, { useState } from 'react';
import { createTicketColumns } from '@/components/columns/ticketColumns';
import { useTicketList } from '@/hooks/useTicketList';
import { DataTable } from '@/components/Tickets/TicketsTable';
import { useTicketModals } from '@/hooks/useTicketModals';
import { useTicketModalTitle } from '@/hooks/useTicketModalTitle';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import TicketsState from '@/components/Tickets/TicketsState';
import TicketsHeader from '@/components/Tickets/TicketsHeader';
import NewTickets from '@/components/Tickets/LazyNewTickets';
import { useGetMe } from '@/queries/auth';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useAuth } from '@/context/AuthContext';
import { isAdmin, isMentor, isIntern } from '@/helpers/roles';
import { BACKLOG_DEFAULT_SORT } from '@/helpers/ticketSort';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

export default function BacklogPage() {
  const [activeTab] = useState('all');
  const { user } = useAuth();
  const { helpers } = useTicketStatuses(user?.workspaceId);
  const backlogStatus = helpers.backlogSlug;

  const {
    tickets: normalizedTickets,
    pagination,
    isLoading: isLoadingRaw,
    isError,
    isPlaceholderData,
    search,
    setSearch,
    setPage,
    sorting,
    setSorting,
  } = useTicketList({
    activeTab,
    additionalFilters: { archived: false, status: backlogStatus },
    // Newest first, and every header sort below goes to the API — the list is
    // paginated, so ordering one page of it would not be an order.
    defaultSort: BACKLOG_DEFAULT_SORT,
  });
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isLoading = useLoaderHold(isLoadingRaw, { release: isError });

  // Held for a full turn of the animation. This is the screen people open most, several times an
  // hour, and a mark that appears and vanishes inside 200ms on a warm cache reads as a glitch
  // rather than as loading. The skeleton behind it carries the shape either way.

  const {
    isNewOpen,
    initialStatus,
    selectedTicketId,
    isDetailsOpen,
    openNewTicket,
    closeNewTicket,
    openTicketDetails,
    closeTicketDetails,
  } = useTicketModals();
  useTicketModalTitle({ ticketId: selectedTicketId, isOpen: isDetailsOpen });

  // Built after the modal hook because the subject cell's blocked-by chip opens a
  // ticket through it.
  const columns = createTicketColumns({
    statusBadgeConfig: helpers.statusBadgeConfig,
    statusIsDone: helpers.statusIsDone,
    statusTracksTime: helpers.statusTracksTime,
    variant: 'backlog',
    onOpenTicket: openTicketDetails,
  });
  const { data: me } = useGetMe();
  const canCreateTicket = isAdmin(me?.role) || isMentor(me?.role) || isIntern(me?.role);

  return (
    <PageShell>
      <NewTickets
        isOpen={isNewOpen}
        onClose={closeNewTicket}
        // The whole point of creating from this page is that the ticket lands
        // in Backlog — defaultMainStatusId (the board's first non-backlog
        // status) would silently send it straight to Tickets/Board instead.
        initialStatus={initialStatus ?? helpers.backlogStatusId}
        hideStatus={true}
      />
      <TicketsHeader
        dataTestPrefix="backlog"
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        hideViewMode={true}
        hideNewTicket={!canCreateTicket}
        onNewTicket={() => openNewTicket(null)}
        title="Backlog"
        subtitle="Triage upcoming tickets before they enter the active flow."
      />

      <PageSection className="flex-1 pt-6">
        <PagePanel className={isPlaceholderData ? 'opacity-60' : ''}>
          <TicketsState
            isLoading={isLoading}
            isError={isError}
            isEmpty={!isLoading && !isError && normalizedTickets.length === 0}
            loadingSlot={
              <LoadingOverlay label="Loading backlog">
                <TableSkeleton />
              </LoadingOverlay>
            }
            emptyIcon={ClipboardList}
            emptyTitle="No backlog tickets"
            emptyDescription="Tickets you park for later triage show up here before they enter the active flow."
            emptyAction={
              canCreateTicket ? (
                <Button
                  onClick={() => openNewTicket(null)}
                  className="h-[34px] rounded-[var(--r-control)] px-3.5 text-[12.5px]"
                  data-test="backlog-empty-new-button"
                >
                  New ticket
                </Button>
              ) : null
            }
          >
            <DataTable
              columns={columns}
              data={normalizedTickets}
              pagination={pagination}
              onPageChange={(newPage) => setPage(newPage)}
              meta={{ onRowClick: openTicketDetails }}
              sorting={sorting}
              onSortingChange={setSorting}
              // Eight columns, ~957px of content: this variant trades TIME SPENT
              // (92px) for CREATED (121px), so it needs more than the shared
              // 840px floor. Below this the panel scrolls inside itself rather
              // than crushing the subject.
              tableClassName="min-w-[960px] table-fixed"
            />
          </TicketsState>
        </PagePanel>
      </PageSection>

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
        onOpenTicket={openTicketDetails}
      />
    </PageShell>
  );
}
