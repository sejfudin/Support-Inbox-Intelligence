import React, { useState } from "react";
import { columns } from "@/components/columns/ticketColumns";
import { useTicketList } from "@/hooks/useTicketList";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { useTicketModals } from "@/hooks/useTicketModals";
import TicketDetailsModal from "@/components/Modals/TicketDetailsModal";
import TicketsState from "@/components/Tickets/TicketsState";
import TicketsHeader from "@/components/Tickets/TicketsHeader";
import NewTickets from "@/components/Tickets/NewTickets";
import { useGetMe } from "@/queries/auth";
import TableSkeleton from "@/components/Skeletons/TableSkeleton";

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
  } = useTicketList({ activeTab, additionalFilters: { status: null } });

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
    <div className="flex min-h-screen flex-col bg-gray-50">
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
      
      <div className="flex-1 p-4 sm:p-6 md:p-8">
        <div
          className={`bg-white rounded-lg shadow min-h-[400px] ${isPlaceholderData ? "opacity-60" : ""}`}
        >
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
              meta={{ onOpenTicket: openTicketDetails }}
            />
          </TicketsState>
        </div>
      </div>

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
      />
    </div>
  );
}
