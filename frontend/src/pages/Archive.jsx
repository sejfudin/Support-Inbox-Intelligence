import React, { useState } from 'react';
import { createTicketColumns } from '@/components/columns/ticketColumns';
import { useTicketList } from '@/hooks/useTicketList';
import { DataTable } from '@/components/Tickets/TicketsTable';
import { useTicketModals } from '@/hooks/useTicketModals';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import TicketsState from '@/components/Tickets/TicketsState';
import TicketsHeader from '@/components/Tickets/TicketsHeader';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useAuth } from '@/context/AuthContext';

export default function ArchivePage() {
  const [activeTab] = useState('all');
  const { user } = useAuth();
  const { helpers } = useTicketStatuses(user?.workspaceId);

  const {
    tickets: normalizedTickets,
    pagination,
    isLoading,
    isError,
    isPlaceholderData,
    search,
    setSearch,
    setPage,
  } = useTicketList({ activeTab, additionalFilters: { archived: true } });

  const columns = createTicketColumns({
    statusBadgeConfig: helpers.statusBadgeConfig,
    statusIsDone: helpers.statusIsDone,
    statusTracksTime: helpers.statusTracksTime,
  });

  const { selectedTicketId, isDetailsOpen, openTicketDetails, closeTicketDetails } =
    useTicketModals();

  return (
    <PageShell>
      <TicketsHeader
        dataTestPrefix="archive"
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        hideViewMode={true}
        hideNewTicket={true}
        title="Archive"
        subtitle="Review completed and closed tickets from this workspace."
      />

      <PageSection className="flex-1 pt-6">
        <PagePanel className={isPlaceholderData ? 'opacity-60' : ''}>
          <TicketsState
            isLoading={isLoading}
            isError={isError}
            isEmpty={!isLoading && !isError && normalizedTickets.length === 0}
            emptyMessage="No archived tickets found."
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
