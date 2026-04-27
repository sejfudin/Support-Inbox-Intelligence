import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { useTickets } from "@/queries/tickets";
import { createTicketColumns } from "@/components/columns/ticketColumns";
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
import { getAllTickets as getAllTicketsApi } from "@/api/tickets";
import { useUsers } from "@/queries/users";
import {
  TICKET_ID_ORDER_VALUES,
  PRIORITY_FILTER_OPTIONS,
  buildAssigneeFilterOptions,
} from "@/helpers/ticketFilters";
import { useAuth } from "@/context/AuthContext";
import TicketFiltersPanel from "@/components/Tickets/TicketsFiltersPanel";
import { useTicketFiltersControls } from "@/hooks/useTicketFiltersControls";
import { buildCsv, downloadCsvFile, formatCsvDate } from "@/helpers/csvExport";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input:not([type='button']):not([type='submit']):not([type='reset']), textarea, select, [contenteditable='true']",
    ),
  );
}

const ALLOWED_TABS = [
  "all",
  "to do",
  "in progress",
  "on staging",
  "blocked",
  "done",
];

const decodeTabParam = (value) =>
  value ? value.toLowerCase().replace(/_/g, " ") : "all";

const encodeTabParam = (value) => value.replace(/\s+/g, "_");
const URL_TICKET_ID_SORT_PARAM = "ticketIdSort";

export default function TicketPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = decodeTabParam(searchParams.get("tab"));
  const initialSearch = searchParams.get("search") || "";
  const initialPage = Math.max(
    parseInt(searchParams.get("page") || "1", 10) || 1,
    1,
  );
  const initialView = searchParams.get("view") === "board" ? "board" : "list";
  const initialTicketIdSortRaw = String(
    searchParams.get(URL_TICKET_ID_SORT_PARAM) || "",
  ).toLowerCase();
  const initialTicketIdSort =
    initialTicketIdSortRaw === TICKET_ID_ORDER_VALUES.ASC ||
    initialTicketIdSortRaw === TICKET_ID_ORDER_VALUES.DESC
      ? initialTicketIdSortRaw
      : TICKET_ID_ORDER_VALUES.NONE;
  const [activeTab, setActiveTab] = useState(
    ALLOWED_TABS.includes(initialTab) ? initialTab : "all",
  );
  const [viewMode, setViewMode] = useState(initialView);

  const isMobile = useIsMobile();
  const effectiveViewMode = isMobile ? "list" : viewMode;
  const isBoard = effectiveViewMode === "board";

  const hasHydratedFromParamsRef = useRef(false);
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
  const isClosingDetailsRef = useRef(false);

  const isValidTicketParam = (value) =>
    typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

  const handleCloseTicketDetails = useMemo(
    () => () => {
      isClosingDetailsRef.current = true;
      const next = new URLSearchParams(searchParams);
      if (next.has("ticket")) {
        next.delete("ticket");
        setSearchParams(next, { replace: true });
      }
      closeTicketDetails();
    },
    [closeTicketDetails, searchParams, setSearchParams],
  );

  useEffect(() => {
    const tid = searchParams.get("ticket");
    if (!isValidTicketParam(tid)) {
      // URL is cleaned, allow normal modal opening again.
      if (!tid) isClosingDetailsRef.current = false;
      return;
    }
    if (isClosingDetailsRef.current) return;
    if (isDetailsOpen && selectedTicketId === tid) return;
    openTicketDetails(tid);
  }, [searchParams, openTicketDetails, isDetailsOpen, selectedTicketId]);

  useEffect(() => {
    if (!hasHydratedFromParamsRef.current) return;
    if (!isDetailsOpen || !selectedTicketId) return;
    if (searchParams.get("ticket") === selectedTicketId) return;
    const next = new URLSearchParams(searchParams);
    next.set("ticket", selectedTicketId);
    setSearchParams(next, { replace: true });
  }, [
    isDetailsOpen,
    selectedTicketId,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        if (isDetailsOpen) {
          e.preventDefault();
          handleCloseTicketDetails();
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
  }, [
    isDetailsOpen,
    isNewOpen,
    handleCloseTicketDetails,
    closeNewTicket,
    openNewTicket,
  ]);

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
    changeDueDateOrder,
    changeTicketIdOrder,
    clearAllFilters,
    removeFilterChip,
    setControls,
  } = useTicketFiltersControls({ assigneeOptions });

  useEffect(() => {
    setControls((prev) =>
      prev.ticketIdOrder === initialTicketIdSort
        ? prev
        : {
            ...prev,
            ticketIdOrder: initialTicketIdSort,
          },
    );
  }, [initialTicketIdSort, setControls]);

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

  const listColumns = useMemo(() => createTicketColumns(), []);

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch] = useDebounce(search, 500);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (hasHydratedFromParamsRef.current) return;
    listData.setSearch(initialSearch);
    listData.setPage(initialPage);
    hasHydratedFromParamsRef.current = true;
  }, [initialSearch, initialPage, listData]);

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
  const handleDueDateOrderChange = runWithListReset(changeDueDateOrder);
  const handleTicketIdOrderChange = runWithListReset(changeTicketIdOrder);
  const handleClearAllFilters = runWithListReset(clearAllFilters);
  const handleRemoveFilterChip = runWithListReset(removeFilterChip);

  const handleSearchChange = (value) => {
    setSearch(value);
    listData.setSearch(value);
    listData.setPage(1);
  };

  useEffect(() => {
    if (!hasHydratedFromParamsRef.current) return;

    const next = new URLSearchParams(searchParams);

    if (activeTab === "all") {
      next.delete("tab");
    } else {
      next.set("tab", encodeTabParam(activeTab));
    }

    if (search.trim()) {
      next.set("search", search.trim());
    } else {
      next.delete("search");
    }

    if (listData.page > 1) {
      next.set("page", String(listData.page));
    } else {
      next.delete("page");
    }

    if (effectiveViewMode === "board") {
      next.set("view", "board");
    } else {
      next.delete("view");
    }

    if (controls.ticketIdOrder !== TICKET_ID_ORDER_VALUES.NONE) {
      next.set(URL_TICKET_ID_SORT_PARAM, controls.ticketIdOrder);
    } else {
      next.delete(URL_TICKET_ID_SORT_PARAM);
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    activeTab,
    search,
    listData.page,
    effectiveViewMode,
    controls.ticketIdOrder,
    searchParams,
    setSearchParams,
  ]);

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
    dueDateOrder: controls.dueDateOrder,
    onDueDateOrderChange: handleDueDateOrderChange,
    ticketIdOrder: controls.ticketIdOrder,
    onTicketIdOrderChange: handleTicketIdOrderChange,
    activeFilterChips,
    onRemoveFilterChip: handleRemoveFilterChip,
    onClearAllFilters: handleClearAllFilters,
  };

  const currentSearch = search;

  const toCsvRows = (tickets) => {
    const header = [
      "title",
      "description",
      "status",
      "assignee",
      "createdAt",
      "updatedAt",
      "dueDate",
    ];
    const rows = tickets.map((ticket) => {
      const raw = ticket.raw || ticket;
      const subject = raw.subject || ticket.title || "";
      const description = raw.description || ticket.description || "";
      const status = raw.status || ticket.status || "";
      const assignee = (raw.assignedTo || [])
        .map((person) => person?.fullname || person?.fullName || person?.email || "")
        .filter(Boolean)
        .join("; ") || "Unassigned";
      const createdAt = formatCsvDate(raw.createdAt);
      const updatedAt = formatCsvDate(raw.updatedAt);
      const dueDate = raw.dueDate || raw.due || "";
      return [subject, description, status, assignee, createdAt, updatedAt, dueDate];
    });
    return buildCsv(header, rows);
  };

  const downloadCsv = (csvString) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const tabSlug = activeTab === "all" ? "all" : encodeTabParam(activeTab);
    downloadCsvFile(`tickets-${tabSlug}-${stamp}.csv`, csvString);
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);

      let ticketsForExport = visibleTickets;
      if (!isBoard) {
        const exportParams = getTicketsQueryParams({
          page: 1,
          search: currentSearch,
          activeTab,
          archived: false,
          status: listStatusFilter,
          workspaceId: overrideWorkspaceId,
          queryFilters,
          listLimit: Math.max(listData.pagination?.total || 0, 1),
        }).list;
        const response = await getAllTicketsApi(exportParams);
        ticketsForExport = (response?.data || []).map((ticket) =>
          normalizeTicket(ticket),
        );
      }

      if (!ticketsForExport.length) {
        toast.info("No tickets to export for current filters.");
        return;
      }

      const csv = toCsvRows(ticketsForExport);
      downloadCsv(csv);
      toast.success("Tickets exported to CSV.");
    } catch (error) {
      console.error("CSV export failed", error);
      toast.error("Failed to export tickets. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

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
        afterNewTicketSlot={
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <TicketFiltersPanel
              {...ticketFiltersPanelProps}
              className="md:items-start"
            />
            <Button
              variant="outline"
              className="w-full md:w-auto"
              onClick={handleExportCsv}
              disabled={isExporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        }
      />

      {!isBoard ? (
        <TicketsTabs
          activeTab={activeTab}
          onChange={(tabKey) => {
            setActiveTab(tabKey);
            listData.setPage(1);
          }}
        />
      ) : null}



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
                columns={listColumns}
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
        onClose={handleCloseTicketDetails}
      />
    </PageShell>
  );
}
