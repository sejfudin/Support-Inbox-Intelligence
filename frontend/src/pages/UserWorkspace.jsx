import { useMemo, useState } from "react";
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

export default function UserWorkspace() {
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

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

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 font-sans">
      <TicketsHeader
        title="My Workspace"
        hideNewTicket={true}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1); 
        }}
      />

      <div className="flex flex-1 flex-col">
        <div className="py-4 md:py-6">
          <SectionCards stats={stats} isLoading={isLoading} />

          <div className="mt-8">
            {isBoard ? (
              <BoardPage
                tickets={normalizedTickets}
                isLoading={isLoading}
                isError={isError}
                onOpenTicket={openTicketDetails}
              />
            ) : (
              <div className="px-4 lg:px-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                      meta={{ onOpenTicket: openTicketDetails }}
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