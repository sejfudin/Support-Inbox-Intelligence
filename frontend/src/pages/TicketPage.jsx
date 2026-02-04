import React, { useMemo, useState } from "react";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { useTickets } from "@/queries/tickets";
import { columns } from "@/components/columns/ticketColumns";
import { useDebounce } from "use-debounce";
import BoardPage from "@/components/BoardPage";
import NewTickets from "@/components/Tickets/NewTickets";
import TicketDetailsModal from "@/components/Modals/TicketDetailsModal";
import TicketsState from "@/components/Tickets/TicketsState";
import TicketsHeader from "@/components/Tickets/TicketsHeader";
import TicketsTabs from "@/components/Tickets/TicketsTabs";
import { getTicketsQueryParams } from "@/helpers/ticketsQuery";
import { normalizeTicket } from "@/helpers/normalizeTicket";
import { useTicketModals } from "@/hooks/useTicketModals";

export default function TicketPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const limit = 10;
  const [debouncedSearch] = useDebounce(search, 500);
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

  const isBoard = viewMode === "board";

  const queryParams = getTicketsQueryParams({
    page,
    search: debouncedSearch,
    activeTab,
    listLimit: limit,
  });

  const listQuery = useTickets(queryParams.list, { enabled: !isBoard });
  const boardQuery = useTickets(queryParams.board, { enabled: isBoard });

  const activeQuery = isBoard ? boardQuery : listQuery;

  const tickets = activeQuery.data?.data || [];
  const pagination = isBoard ? null : activeQuery.data?.pagination;

  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;
  const isPlaceholderData = activeQuery.isPlaceholderData;

  const normalizedTickets = useMemo(
    () => tickets.map((ticket) => normalizeTicket(ticket)),
    [tickets],
  );
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <NewTickets
        isOpen={isNewOpen}
        onClose={closeNewTicket}
        initialStatus={initialStatus}
      />
      <TicketsHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onNewTicket={openNewTicket}
      />

      {/* Conditional Content Based on View Mode */}
      {viewMode === "board" ? (
        <BoardPage
          tickets={normalizedTickets}
          isLoading={isLoading}
          isError={isError}
          onNewTicket={openNewTicket}
          onOpenTicket={openTicketDetails}
        />
      ) : (
        <>
          {/* Tabs - Only visible in list view */}
          <TicketsTabs
            activeTab={activeTab}
            onChange={(tabKey) => {
              setActiveTab(tabKey);
              setPage(1);
            }}
          />

          {/* Content */}
          <div className="flex-1 p-4 sm:p-6 md:p-8">
            <div
              className={`bg-white rounded-lg shadow min-h-[400px] ${isPlaceholderData ? "opacity-60" : ""}`}
            >
              <TicketsState
                isLoading={isLoading}
                isError={isError}
                isEmpty={!isLoading && !isError && normalizedTickets.length === 0}
                emptyMessage="No tickets found."
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
        </>
      )}

      {/* Modals - Always rendered */}
      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
      />
    </div>
  );
}
