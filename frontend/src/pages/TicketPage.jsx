import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useUsers } from "@/queries/users";
import {
  PRIORITY_FILTER_OPTIONS,
  buildAssigneeFilterOptions,
} from "@/helpers/ticketFilters";
import { useAuth } from "@/context/AuthContext";
import TicketFiltersPanel from "@/components/Tickets/TicketsFiltersPanel";
import { useTicketFiltersControls } from "@/hooks/useTicketFiltersControls";

function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input:not([type='button']):not([type='submit']):not([type='reset']), textarea, select, [contenteditable='true']",
    ),
  );
}

export default function TicketPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState("list");

  const isMobile = useIsMobile();
  const effectiveViewMode = isMobile ? "list" : viewMode;
  const isBoard = effectiveViewMode === "board";

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const overrideWorkspaceId = searchParams.get("workspaceId") || undefined;
  const { user } = useAuth();
  const { data: overrideWorkspace } = useWorkspace(overrideWorkspaceId);

  const effectiveWorkspaceId = overrideWorkspaceId || user?.workspaceId;

  const { data: usersData } = useUsers({
    pagination: false,
    workspaceId: effectiveWorkspaceId,
  });

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

  const searchInputRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        if (isDetailsOpen) {
          e.preventDefault();
          closeTicketDetails();
          return;
        }
        if (isNewOpen) {
          e.preventDefault();
          closeNewTicket();
          return;
        }
        return;
      }

      if (isEditableTarget(e.target)) return;
      if (isDetailsOpen || isNewOpen) return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "n") {
        e.preventDefault();
        openNewTicket();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDetailsOpen, isNewOpen, closeTicketDetails, closeNewTicket, openNewTicket]);

  const listStatusFilter = activeTab === "all" ? "not_null" : activeTab;

  const queryClient = useQueryClient();
  const updateTicketMutation = useUpdateTicket();

  const assigneeOptions = useMemo(
    () => buildAssigneeFilterOptions(usersData?.users || []),
    [usersData?.users],
  );

  const {
    controls,
    queryFilters,
    activeFilterChips,
    togglePriority,
    toggleAssignee,
    changePriorityOrder,
    clearAllFilters,
    removeFilterChip,
  } = useTicketFiltersControls({ assigneeOptions });

  const listData = useTicketList({
    activeTab,
    enabled: !isBoard,
    queryFilters,
    additionalFilters: {
      archived: false,
      status: listStatusFilter,
      workspaceId: overrideWorkspaceId,
    },
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

  const boardQueryParams = getTicketsQueryParams({
    page: 1,
    search: debouncedSearch,
    activeTab,
    archived: false,
    status: "not_null",
    workspaceId: overrideWorkspaceId,
    queryFilters,
  });

  const boardQuery = useTickets(boardQueryParams.board, { enabled: isBoard });

  const boardTickets = useMemo(
    () => (boardQuery.data?.data || []).map((ticket) => normalizeTicket(ticket)),
    [boardQuery.data?.data],
  );

  const normalizedTickets = isBoard ? boardTickets : listData.tickets;
  const pagination = isBoard ? null : listData.pagination;
  const isLoading = isBoard ? boardQuery.isLoading : listData.isLoading;
  const isError = isBoard ? boardQuery.isError : listData.isError;
  const isPlaceholderData = isBoard ? false : listData.isPlaceholderData;
  const visibleTickets = normalizedTickets;

  const runWithListReset = (callback) => (...args) => {
    callback(...args);
    if (!isBoard) listData.setPage(1);
  };

  const handlePriorityFilterChange = runWithListReset(togglePriority);
  const handleAssigneeFilterChange = runWithListReset(toggleAssignee);
  const handlePriorityOrderChange = runWithListReset(changePriorityOrder);
  const handleClearAllFilters = runWithListReset(clearAllFilters);
  const handleRemoveFilterChip = runWithListReset(removeFilterChip);

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
      backlog: "backlog",
    };

    const newStatus = columnToStatus[columnId] || columnId;

    updateTicketMutation.mutate(
      {
        ticketId,
        updates: { status: newStatus },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
        },
        onError: (err) => console.error("Error updating ticket: ", err),
      },
    );
  };

  const ticketFiltersPanelProps = {
    selectedPriorities: controls.priorities,
    onTogglePriority: handlePriorityFilterChange,
    priorityOptions: PRIORITY_FILTER_OPTIONS,
    selectedAssigneeIds: controls.assigneeIds,
    onToggleAssignee: handleAssigneeFilterChange,
    assigneeOptions,
    priorityOrder: controls.priorityOrder,
    onPriorityOrderChange: handlePriorityOrderChange,
    activeFilterChips,
    onRemoveFilterChip: handleRemoveFilterChip,
    onClearAllFilters: handleClearAllFilters,
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
        viewMode={effectiveViewMode}
        onViewModeChange={setViewMode}
        search={currentSearch}
        onSearch={handleSearchChange}
        onNewTicket={openNewTicket}
        searchInputRef={searchInputRef}
        hideViewMode={isMobile}
      />

      {!isBoard ? (
  <PageSection className="pt-4 pb-0">
    <div className="flex w-full flex-col gap-3 md:flex-row md:items-start">
      <div className="w-full md:w-auto md:flex-none">
        <TicketFiltersPanel {...ticketFiltersPanelProps} className="md:items-start" />
      </div>

      <div className="min-w-0 w-full md:ml-auto md:max-w-[82%]">
        <TicketsTabs
          activeTab={activeTab}
          onChange={(tabKey) => {
            setActiveTab(tabKey);
            listData.setPage(1);
          }}
          className="pt-0"
        />
      </div>
    </div>
  </PageSection>
) : (
  <PageSection className="pt-4 pb-0">
    <div className="flex w-full justify-start">
      <TicketFiltersPanel {...ticketFiltersPanelProps} className="md:items-start" />
    </div>
  </PageSection>
)}


      {isBoard ? (
        <BoardPage
          tickets={visibleTickets}
          isLoading={isLoading}
          isError={isError}
          onNewTicket={openNewTicket}
          onOpenTicket={openTicketDetails}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <PageSection className="flex-1 pt-6">
          <PagePanel className={isPlaceholderData ? "opacity-60" : ""}>
            <TicketsState
              isLoading={isLoading}
              isError={isError}
              isEmpty={!isLoading && !isError && visibleTickets.length === 0}
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
      )}

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
      />
    </PageShell>
  );
}
