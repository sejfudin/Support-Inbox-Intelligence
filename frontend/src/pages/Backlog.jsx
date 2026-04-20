import React, { useState } from "react";
import { createTicketColumns } from "@/components/columns/ticketColumns";
import { useTicketList } from "@/hooks/useTicketList";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { useTicketModals } from "@/hooks/useTicketModals";
import TicketDetailsModal from "@/components/Modals/TicketDetailsModal";
import TicketsState from "@/components/Tickets/TicketsState";
import TicketsHeader from "@/components/Tickets/TicketsHeader";
import NewTickets from "@/components/Tickets/NewTickets";
import { useGetMe } from "@/queries/auth";
import TableSkeleton from "@/components/Skeletons/TableSkeleton";
import { PagePanel, PageSection, PageShell } from "@/components/PageShell";

export default function BacklogPage() {
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
  } = useTicketList({ activeTab, additionalFilters: { archived: false, status: 'backlog' } });

  const columns = createTicketColumns();

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
  const isAdmin = me?.role === "admin";

  return (
    <PageShell>
      <NewTickets
        isOpen={isNewOpen}
        onClose={closeNewTicket}
        initialStatus={initialStatus}
        hideStatus={true}
      />
      <TicketsHeader
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        hideViewMode={true}
        hideNewTicket={!isAdmin}
        onNewTicket={() => openNewTicket(null)}
        title="Backlog"
      />
      
      <PageSection className="flex-1 pt-6">
        <PagePanel className={isPlaceholderData ? "opacity-60" : ""}>
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
