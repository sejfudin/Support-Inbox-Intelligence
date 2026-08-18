import React, { useState } from 'react';
import { Archive as ArchiveIcon } from 'lucide-react';
import { createTicketColumns } from '@/components/columns/ticketColumns';
import { useTicketList } from '@/hooks/useTicketList';
import { DataTable } from '@/components/Tickets/TicketsTable';
import { useTicketModals } from '@/hooks/useTicketModals';
import { useTicketModalTitle } from '@/hooks/useTicketModalTitle';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import TicketsState from '@/components/Tickets/TicketsState';
import TicketsHeader from '@/components/Tickets/TicketsHeader';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useAuth } from '@/context/AuthContext';
import { useArchiveTicket, useUnarchiveTicket } from '@/queries/tickets';
import { ARCHIVE_DEFAULT_SORT } from '@/helpers/ticketSort';
import { toast } from 'sonner';

export default function ArchivePage() {
  const [activeTab] = useState('all');
  const { user } = useAuth();
  const { helpers } = useTicketStatuses(user?.workspaceId);

  const { mutate: unarchiveTicket } = useUnarchiveTicket();
  const { mutate: archiveTicket } = useArchiveTicket();

  // Restore is reversible and low-harm, so act on click without a confirm dialog.
  // The success toast offers Undo (re-archive) for accidental clicks.
  const handleRestore = (ticket) => {
    if (!ticket?.id) return;
    unarchiveTicket(ticket.id, {
      onSuccess: () => {
        toast.success('Ticket restored', {
          description: `#${ticket.taskNumber ?? ''} is back in the active views.`,
          action: {
            label: 'Undo',
            onClick: () => archiveTicket(ticket.id),
          },
        });
      },
      onError: (error) => {
        toast.error('Failed to restore ticket', {
          description: error?.response?.data?.message || 'Please try again.',
        });
      },
    });
  };

  const {
    tickets: normalizedTickets,
    pagination,
    isLoading,
    isError,
    isPlaceholderData,
    search,
    setSearch,
    setPage,
    sorting,
    setSorting,
  } = useTicketList({
    activeTab,
    additionalFilters: { archived: true },
    // Archived date, newest first. The list is paginated, so `useTicketList`
    // sends the order to the API rather than reordering the page in the browser.
    defaultSort: ARCHIVE_DEFAULT_SORT,
  });

  const { selectedTicketId, isDetailsOpen, openTicketDetails, closeTicketDetails } =
    useTicketModals();

  const columns = createTicketColumns({
    statusBadgeConfig: helpers.statusBadgeConfig,
    statusIsDone: helpers.statusIsDone,
    statusTracksTime: helpers.statusTracksTime,
    variant: 'archive',
    onRestore: handleRestore,
    onOpenTicket: openTicketDetails,
  });

  useTicketModalTitle({ ticketId: selectedTicketId, isOpen: isDetailsOpen });

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
        subtitle="Archived tickets — restore any to bring it back to the active board."
      />

      <PageSection className="flex-1 pt-6">
        <PagePanel className={isPlaceholderData ? 'opacity-60' : ''}>
          <TicketsState
            isLoading={isLoading}
            isError={isError}
            isEmpty={!isLoading && !isError && normalizedTickets.length === 0}
            emptyIcon={ArchiveIcon}
            emptyTitle="No archived tickets"
            emptyDescription="Archived tickets stay here; restore any one to bring it back to the active board."
            loadingSlot={<TableSkeleton />}
          >
            <DataTable
              columns={columns}
              data={normalizedTickets}
              pagination={pagination}
              onPageChange={(newPage) => setPage(newPage)}
              meta={{ onRowClick: openTicketDetails }}
              sorting={sorting}
              onSortingChange={setSorting}
              // Six columns, ~677px of content: below this the panel scrolls
              // inside itself rather than crushing the subject.
              tableClassName="min-w-[720px] table-fixed"
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
