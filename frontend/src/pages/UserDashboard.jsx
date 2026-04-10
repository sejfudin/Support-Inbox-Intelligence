import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { columns } from "@/components/columns/ticketColumns";
import { SectionCards } from "@/components/section-cards";
import { useMyTickets } from "@/queries/tickets";
import { normalizeTicket } from "@/helpers/normalizeTicket";
import TicketsState from "@/components/Tickets/TicketsState";
import TableSkeleton from "@/components/Skeletons/TableSkeleton";
import TicketsHeader from "@/components/Tickets/TicketsHeader";
import BoardPage from "@/components/BoardPage";
import TicketDetailsModal from "@/components/Modals/TicketDetailsModal";
import { useTicketModals } from "@/hooks/useTicketModals";
import { useDebounce } from "use-debounce";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateTicket } from "@/queries/tickets";

export default function UserDashboard() {
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const isMobile = useIsMobile();
  const [debouncedSearch] = useDebounce(search, 500);
  const queryClient = useQueryClient();
  const updateTicketMutation = useUpdateTicket();

  const {
    selectedTicketId,
    isDetailsOpen,
    openTicketDetails,
    closeTicketDetails,
  } = useTicketModals();

  const { data: ticketsData, isLoading, isError } = useMyTickets({
    page,
    limit: 10,
    search: debouncedSearch,
  });

  const normalizedTickets = useMemo(() => {
    return (ticketsData?.data || []).map((ticket) => normalizeTicket(ticket));
  }, [ticketsData]);

  const stats = useMemo(() => {
    if (!ticketsData?.stats) return null;

    const { activeTickets, inProgress, blocked } = ticketsData.stats;
    const now = new Date();
    const monthLabel = now.toLocaleString("default", { month: "short" });

    return {
      activeTickets: activeTickets || 0,
      inProgress: inProgress || 0,
      blocked: blocked || 0,
      completedThisMonth: ticketsData.stats.completedThisMonth || 0,
      monthLabel,
      activeTrend: 0,
      inProgressTrend: 0,
      completedTrend: 0,
      blockedTrend: 0,
    };
  }, [ticketsData]);

  const isBoard = viewMode === "board";

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
      onSuccess: () => console.log("MUTACIJA USPJELA NA SERVERU"),
      onError: (err) => console.error("MUTACIJA DOŽIVJELA ERROR:", err)
    });
  };

  useEffect(() => {
    if (isMobile && viewMode === "board") {
      setViewMode("list");
    }
  }, [isMobile, viewMode]);

  return (
    <main className="app-page flex min-h-screen flex-col font-sans">
      <TicketsHeader
        title="Dashboard"
        hideNewTicket={true}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        hideViewMode={isMobile}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1); 
        }}
      />

      <div className="flex flex-1 flex-col">
        <div className="py-4 md:py-6">
          <SectionCards stats={stats} isLoading={isLoading} />

          <div className="app-page-content mt-2">
            {!isMobile && isBoard ? (
              <BoardPage
                tickets={normalizedTickets}
                isLoading={isLoading}
                isError={isError}
                onOpenTicket={openTicketDetails}
                onStatusChange={handleStatusChange}
              />
            ) : (
              <div>
                <div className="app-panel overflow-hidden">
                  <TicketsState
                    isLoading={isLoading}
                    isError={isError}
                    isEmpty={!isLoading && !isError && normalizedTickets.length === 0}
                    emptyMessage="No tickets assigned to you found."
                    loadingSlot={<TableSkeleton />}
                  >
                    <DataTable
                      columns={columns}
                      data={normalizedTickets}
                      pagination={ticketsData?.pagination}
                      onPageChange={(newPage) => setPage(newPage)}
                      meta={{ onRowClick: openTicketDetails }}
                    />
                  </TicketsState>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
      />
    </main>
  );
}
