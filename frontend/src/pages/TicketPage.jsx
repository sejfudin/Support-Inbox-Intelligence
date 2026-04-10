import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import TableSkeleton from "@/components/Skeletons/TableSkeleton";
import { getTicketsQueryParams } from "@/helpers/ticketsQuery";
import { normalizeTicket } from "@/helpers/normalizeTicket";
import { useTicketModals } from "@/hooks/useTicketModals";
import { useTicketList } from "@/hooks/useTicketList";
import { useWorkspace } from "@/queries/workspaces";
import { ArrowLeft, Building2 } from "lucide-react";
import { PagePanel, PageSection, PageShell } from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateTicket } from "@/queries/tickets";

export default function TicketPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const overrideWorkspaceId = searchParams.get("workspaceId") || undefined;
  const { data: overrideWorkspace } = useWorkspace(overrideWorkspaceId);

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
  const listStatusFilter = activeTab === "all" ? "not_null" : activeTab;

  const queryClient = useQueryClient(); 
  const updateTicketMutation = useUpdateTicket();

  useEffect(() => {
    if (isMobile && viewMode === "board") {
      setViewMode("list");
    }
  }, [isMobile, viewMode]);


  // List view data
  const listData = useTicketList({
    activeTab,
    enabled: !isBoard,
    additionalFilters: { archived: false, status: listStatusFilter, workspaceId: overrideWorkspaceId },
  });

  // Board view data
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

  const boardQueryParams = getTicketsQueryParams({
    page: 1,
    search: debouncedSearch,
    activeTab,
    archived: false,
    status: "not_null",
    workspaceId: overrideWorkspaceId,
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
  
  const visibleTickets = useMemo(() => {
    return normalizedTickets.filter((ticket) => ticket.status !== 'backlog');
  }, [normalizedTickets]);

  const handleSearchChange = (value) => {
    if (isBoard) {
      setSearch(value);
    } else {
      listData.setSearch(value);
      listData.setPage(1);
    }
  };

  const handleStatusChange = (ticketId, columnId) => {

    const columnToStatus = {
      todo: "to do",          
      inprogress: "in progress",
      staging: "on staging",    
      done: "done",
      blocked: "blocked",
      backlog: "backlog"
    };

    const newStatus = columnToStatus[columnId] || columnId;

    console.log("Pokušavam mutate za:", ticketId, newStatus);

    updateTicketMutation.mutate({
      ticketId: ticketId,
      updates: { status: newStatus }
    }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); },
      onError: (err) => console.error("Error updating ticket: ", err)
    });
  };

  const currentSearch = isBoard ? search : listData.search;
  return (
    <PageShell>
      {overrideWorkspaceId && (
        <PageSection className="pb-0">
          <div className="app-panel-soft flex items-center gap-3 px-5 py-3 text-sm text-blue-800">
            <Building2 className="h-4 w-4 shrink-0" />
            <span>
              Viewing workspace: <strong>{overrideWorkspace?.name ?? overrideWorkspaceId}</strong>
            </span>
            <button
              onClick={() => navigate(`/admin/workspaces/${overrideWorkspaceId}`)}
              className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to workspace
            </button>
          </div>
        </PageSection>
      )}
      <NewTickets
        isOpen={isNewOpen}
        onClose={closeNewTicket}
        initialStatus={initialStatus}
        workspaceId={overrideWorkspaceId}
      />
      <TicketsHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={currentSearch}
        onSearch={handleSearchChange}
        onNewTicket={openNewTicket}
        hideViewMode={isMobile}
      />

      {/* Conditional Content Based on View Mode */}
      {!isMobile && viewMode === "board" ? (
        <BoardPage
          tickets={visibleTickets}
          isLoading={isLoading}
          isError={isError}
          onNewTicket={openNewTicket}
          onOpenTicket={openTicketDetails}
          onStatusChange={handleStatusChange}
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
          <PageSection className="flex-1 pt-6">
            <PagePanel className={isPlaceholderData ? "opacity-60" : ""}>
              <TicketsState
                isLoading={isLoading}
                isError={isError}
                isEmpty={
                  !isLoading && !isError && visibleTickets.length === 0
                }
                emptyMessage="No tickets found."
                loadingSlot={<TableSkeleton />}
              >
                <DataTable
                  columns={columns}
                  data={visibleTickets}
                  pagination={pagination}
                  onPageChange={(newPage) => listData.setPage(newPage)}
                  meta={{ onRowClick: openTicketDetails }}
                />
              </TicketsState>
            </PagePanel>
          </PageSection>
        </>
      )}

      {/* Modals - Always rendered */}
      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
      />
    </PageShell>
  );
}
