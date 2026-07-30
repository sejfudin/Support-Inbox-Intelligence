import React, { useState } from 'react';
import { createTicketColumns } from '@/components/columns/ticketColumns';
import { useTicketList } from '@/hooks/useTicketList';
import { DataTable } from '@/components/Tickets/TicketsTable';
import { useTicketModals } from '@/hooks/useTicketModals';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import TicketsState from '@/components/Tickets/TicketsState';
import TicketsHeader from '@/components/Tickets/TicketsHeader';
import NewTickets from '@/components/Tickets/LazyNewTickets';
import { useGetMe } from '@/queries/auth';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useAuth } from '@/context/AuthContext';
import { isAdmin, isMentor, isIntern } from '@/helpers/roles';

export default function BacklogPage() {
  const [activeTab] = useState('all');
  const { user } = useAuth();
  const { helpers } = useTicketStatuses(user?.workspaceId);
  const backlogStatus = helpers.backlogSlug;

  const {
    tickets: normalizedTickets,
    pagination,
    isLoading,
    isError,
    isPlaceholderData,
    search,
    setSearch,
    setPage,
  } = useTicketList({ activeTab, additionalFilters: { archived: false, status: backlogStatus } });

  const columns = createTicketColumns({
    statusBadgeConfig: helpers.statusBadgeConfig,
    statusIsDone: helpers.statusIsDone,
    statusTracksTime: helpers.statusTracksTime,
  });

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
  const { data: me } = useGetMe();
  const canCreateTicket = isAdmin(me?.role) || isMentor(me?.role) || isIntern(me?.role);

  return (
    <PageShell>
      <NewTickets
        isOpen={isNewOpen}
        onClose={closeNewTicket}
        initialStatus={initialStatus ?? helpers.defaultMainStatusId}
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
            emptyMessage="No backlog tickets found."
            loadingSlot={<TableSkeleton />}
          >
            <DataTable
              columns={columns}
              data={normalizedTickets}
              pagination={pagination}
              onPageChange={(newPage) => setPage(newPage)}
              meta={{ onRowClick: openTicketDetails }}
            />
          </TicketsState>
        </PagePanel>
      </PageSection>

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
      />
    </PageShell>
  );
}
