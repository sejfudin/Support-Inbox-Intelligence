import React, { useState, useMemo } from "react";
import { createTicketColumns } from "@/components/columns/ticketColumns";
import { useTicketList } from "@/hooks/useTicketList";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { useTicketModals } from "@/hooks/useTicketModals";
import TicketDetailsModal from "@/components/Modals/TicketDetailsModal";
import TicketsState from "@/components/Tickets/TicketsState";
import TicketsHeader from "@/components/Tickets/TicketsHeader";
import TableSkeleton from "@/components/Skeletons/TableSkeleton";
import { PagePanel, PageSection, PageShell } from "@/components/PageShell";

export default function ArchivePage() {
  const [activeTab] = useState("all");

  const {
    tickets: normalizedTickets,
    pagination,
    isLoading,
    isError,
    isPlaceholderData,
    search,
    setSearch,
    setPage,
    sortBy,
    sortOrder,
    toggleDueDateSort,
  } = useTicketList({ activeTab, additionalFilters: { archived: true } });

  const columns = useMemo(
    () =>
      createTicketColumns({
        sortBy,
        sortOrder,
        onDueDateSort: toggleDueDateSort,
      }),
    [sortBy, sortOrder, toggleDueDateSort],
  );

  const {
    selectedTicketId,
    isDetailsOpen,
    openTicketDetails,
    closeTicketDetails,
  } = useTicketModals();

  return (
    <PageShell>
      <TicketsHeader
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        hideViewMode={true}
        hideNewTicket={true}
        title="Archive"
      />
      
      <PageSection className="flex-1 pt-6">
        <PagePanel className={isPlaceholderData ? "opacity-60" : ""}>
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
