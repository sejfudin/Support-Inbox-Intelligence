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
import { useTicketList } from "@/hooks/useTicketList";

export default function TicketPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState("list");

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

  // List view data
  const listData = useTicketList({
    activeTab,
    enabled: !isBoard,
    additionalFilters: { archived: false },
  });

  // Board view data
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

  const boardQueryParams = getTicketsQueryParams({
    page: 1,
    search: debouncedSearch,
    activeTab,
    archived: false,
  });

  const boardQuery = useTickets(boardQueryParams.board, { enabled: isBoard });

  const boardTickets = useMemo(
    () =>
      (boardQuery.data?.data || []).map((ticket) => normalizeTicket(ticket)),
    [boardQuery.data?.data],
  );

  // Use appropriate data based on view mode
  const normalizedTickets = isBoard ? boardTickets : listData.tickets;
  const pagination = isBoard ? null : listData.pagination;
  const isLoading = isBoard ? boardQuery.isLoading : listData.isLoading;
  const isError = isBoard ? boardQuery.isError : listData.isError;
  const isPlaceholderData = isBoard ? false : listData.isPlaceholderData;

  const handleSearchChange = (value) => {
    if (isBoard) {
      setSearch(value);
    } else {
      listData.setSearch(value);
      listData.setPage(1);
    }
  };

  const currentSearch = isBoard ? search : listData.search;
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
        search={currentSearch}
        onSearch={handleSearchChange}
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
              listData.setPage(1);
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
                isEmpty={
                  !isLoading && !isError && normalizedTickets.length === 0
                }
                emptyMessage="No tickets found."
              >
                <DataTable
                  columns={columns}
                  data={normalizedTickets}
                  pagination={pagination}
                  onPageChange={(newPage) => listData.setPage(newPage)}
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
