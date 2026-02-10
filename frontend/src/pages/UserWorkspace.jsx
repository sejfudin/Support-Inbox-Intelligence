import { useMemo, useState } from "react";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { columns } from "@/components/columns/ticketColumns";
import { SectionCards } from "@/components/section-cards";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTickets } from "@/queries/tickets";
import { normalizeTicket } from "@/helpers/normalizeTicket";
import TicketsState from "@/components/Tickets/TicketsState";
import TableSkeleton from "@/components/Skeletons/TableSkeleton";
import TicketsHeader from "@/components/Tickets/TicketsHeader";
import { useDebounce } from "use-debounce";

export default function UserWorkspace() {
  const { user } = useAuth();
  const {
    data: ticketsData,
    isLoading,
    isError,
  } = useTickets({
    limit: 1000,
    archived: false,
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

  const myTickets = useMemo(() => {
    if (!ticketsData?.data || !user) return [];

    const userId = user._id;
    return ticketsData.data.filter((ticket) =>
      ticket.assignedTo?.some((assignee) => assignee._id === userId),
    );
  }, [ticketsData, user]);

  const filteredTickets = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return myTickets;

    return myTickets.filter((ticket) => {
      const subject = ticket.subject ?? ticket.title ?? "";
      const description = ticket.description ?? "";
      return (
        subject.toLowerCase().includes(term) ||
        description.toLowerCase().includes(term)
      );
    });
  }, [myTickets, debouncedSearch]);

  const normalizedTickets = useMemo(() => {
    return filteredTickets.map((ticket) => normalizeTicket(ticket));
  }, [filteredTickets]);

  const pagination = useMemo(() => {
    const total = normalizedTickets.length;
    return {
      page: 1,
      limit: total || 10,
      total: total,
      pages: 1,
    };
  }, [normalizedTickets.length]);

  const stats = useMemo(() => {
    if (myTickets.length === 0) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthLabel = now.toLocaleString("default", { month: "short" });

    const activeStatuses = new Set([
      "to do",
      "in progress",
      "on staging",
      "blocked",
    ]);
    const inProgressStatuses = new Set(["in progress", "on staging"]);

    const activeTickets = myTickets.filter(
      (t) => !t.isArchived && activeStatuses.has(t.status),
    ).length;

    const inProgress = myTickets.filter(
      (t) => !t.isArchived && inProgressStatuses.has(t.status),
    ).length;

    const blocked = myTickets.filter(
      (t) => t.status === "blocked" && !t.isArchived,
    ).length;

    const completedThisMonth = myTickets.filter((t) => {
      if (t.status !== "done") return false;
      const updatedAt = new Date(t.updatedAt);
      return (
        updatedAt.getMonth() === currentMonth &&
        updatedAt.getFullYear() === currentYear
      );
    }).length;

    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const completedLastMonth = myTickets.filter((t) => {
      if (t.status !== "done") return false;
      const updatedAt = new Date(t.updatedAt);
      return (
        updatedAt.getMonth() === lastMonth &&
        updatedAt.getFullYear() === lastMonthYear
      );
    }).length;

    return {
      activeTickets,
      inProgress,
      completedThisMonth,
      blocked,
      monthLabel,
      activeTrend: 0,
      inProgressTrend: 0,
      completedTrend: completedThisMonth - completedLastMonth,
      blockedTrend: 0,
    };
  }, [myTickets]);

  return (
    <main>
      <TicketsHeader
        hideViewMode={true}
        hideNewTicket={true}
        title="Workspace"
        search={search}
        onSearch={(value) => setSearch(value)}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards stats={stats} isLoading={isLoading} />

            <div className="px-4 lg:px-6">
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <TicketsState
                  isLoading={isLoading}
                  isError={isError}
                  isEmpty={
                    !isLoading && !isError && normalizedTickets.length === 0
                  }
                  emptyMessage="You have no assigned tickets."
                  loadingSlot={<TableSkeleton />}
                >
                  <DataTable
                    columns={columns}
                    data={normalizedTickets}
                    pagination={pagination}
                    onPageChange={() => {}}
                  />
                </TicketsState>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
