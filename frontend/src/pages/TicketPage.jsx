import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/Tickets/TicketsTable';
import { createTicketColumns } from '@/components/columns/ticketColumns';
import { useDebounce } from 'use-debounce';
import NewTickets from '@/components/Tickets/LazyNewTickets';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import TicketsState from '@/components/Tickets/TicketsState';
import TicketsHeader from '@/components/Tickets/TicketsHeader';
import { readStoredPreference, useStoredPreference } from '@/hooks/useStoredPreference';
import {
  ASSIGNEE_DEFAULT_STORAGE_KEY,
  DEFAULT_ASSIGNEE_DEFAULT,
  DEFAULT_TICKETS_VIEW,
  TICKETS_VIEW_STORAGE_KEY,
  isValidAssigneeDefault,
  isValidTicketsView,
} from '@/helpers/uiPreferences';
import {
  BOARD_SORT_STORAGE_KEY,
  DEFAULT_BOARD_SORT,
  isValidBoardSort,
} from '@/helpers/boardCardSort';
import TicketsTabs from '@/components/Tickets/TicketsTabs';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { getTicketsQueryParams } from '@/helpers/ticketsQuery';
import { normalizeTicket, extractStatusSlug } from '@/helpers/normalizeTicket';
import { useTicketModals } from '@/hooks/useTicketModals';
import { useTicketList } from '@/hooks/useTicketList';
import { useWorkspace } from '@/queries/workspaces';
import { ArrowLeft, Building2 } from 'lucide-react';
import { PageSection, PageShell } from '@/components/PageShell';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { useTickets, useUpdateTicket } from '@/queries/tickets';
import { useTicketModalTitle } from '@/hooks/useTicketModalTitle';
import { invalidateWorkspaceTicketsScope } from '@/lib/invalidationScopes';
import { getAllTickets as getAllTicketsApi } from '@/api/tickets';
import { useUsers } from '@/queries/users';
import {
  TICKET_ID_ORDER_VALUES,
  PRIORITY_FILTER_OPTIONS,
  buildAssigneeFilterOptions,
  DEFAULT_EXPORT_PERIOD,
  buildExportPeriodQueryParam,
  getExportPeriodFilenameSuffix,
} from '@/helpers/ticketFilters';
import TicketExportPeriodSelect from '@/components/Tickets/TicketExportPeriodSelect';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import TicketFiltersPanel from '@/components/Tickets/TicketsFiltersPanel';
import { useTicketFiltersControls } from '@/hooks/useTicketFiltersControls';
import { buildCsv, downloadCsvFile, formatCsvDate } from '@/helpers/csvExport';
import { Button } from '@/components/ui/button';
import { Download, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useTimeSpentTicker } from '@/hooks/useTimeSpentTicker';

const BoardPage = lazy(() => import('@/components/BoardPage'));

function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input:not([type='button']):not([type='submit']):not([type='reset']), textarea, select, [contenteditable='true']"
    )
  );
}

function TicketExportMenu({ exportPeriod, onExportPeriodChange, onExportCsv, isExporting }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" data-test="ticket-export-menu-trigger">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Export period</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <TicketExportPeriodSelect value={exportPeriod} onValueChange={onExportPeriodChange} />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onExportCsv}
          disabled={isExporting}
          data-test="ticket-export-csv-menu-item"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const decodeTabParam = (value) => (value ? value.toLowerCase().replace(/_/g, ' ') : 'all');

const encodeTabParam = (value) => value.replace(/\s+/g, '_');
const URL_TICKET_ID_SORT_PARAM = 'ticketIdSort';
const URL_ASSIGNEE_PARAM = 'assignee';
// The alias the intern dashboard links with. Resolved against the signed-in user
// on both read and write, so the URL never carries a raw id for "my tickets".
const ASSIGNEE_SELF = 'me';

export default function TicketPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = decodeTabParam(searchParams.get('tab'));
  const initialSearch = searchParams.get('search') || '';
  const initialPage = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  // A `?view=` param wins — a shared link means the view it names. Without one,
  // the page opens in whichever surface was last chosen, read synchronously from
  // the preference cache so the board never flashes as a list on the way in.
  const viewParam = searchParams.get('view');
  const initialView =
    viewParam === 'board' || viewParam === 'list'
      ? viewParam
      : readStoredPreference(TICKETS_VIEW_STORAGE_KEY, DEFAULT_TICKETS_VIEW, isValidTicketsView);
  const initialTicketIdSortRaw = String(
    searchParams.get(URL_TICKET_ID_SORT_PARAM) || ''
  ).toLowerCase();
  const initialTicketIdSort =
    initialTicketIdSortRaw === TICKET_ID_ORDER_VALUES.ASC ||
    initialTicketIdSortRaw === TICKET_ID_ORDER_VALUES.DESC
      ? initialTicketIdSortRaw
      : TICKET_ID_ORDER_VALUES.NONE;
  // `?assignee=` seeds the assignee filter, comma-separated. `me` is an alias for
  // the caller's own id so the intern dashboard can link here without embedding a
  // user id in the URL, and so the link means the same thing for whoever opens it.
  // No `?assignee=` in the link falls back to Settings → Default assignee
  // filter, which seeds the same `me` alias the intern dashboard links with.
  const initialAssigneeRaw =
    searchParams.get(URL_ASSIGNEE_PARAM) ||
    (readStoredPreference(
      ASSIGNEE_DEFAULT_STORAGE_KEY,
      DEFAULT_ASSIGNEE_DEFAULT,
      isValidAssigneeDefault
    ) === 'me'
      ? ASSIGNEE_SELF
      : '');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [viewMode, setViewMode] = useState(initialView);
  const [, storeTicketsView] = useStoredPreference(
    TICKETS_VIEW_STORAGE_KEY,
    DEFAULT_TICKETS_VIEW,
    isValidTicketsView
  );

  // Only the header's own toggle writes the preference. Arriving on `?view=board`
  // from someone else's link is not a statement about how you like to work, so
  // hydrating from the URL deliberately does not go through here.
  const changeViewMode = useCallback(
    (next) => {
      setViewMode(next);
      storeTicketsView(next);
    },
    [storeTicketsView]
  );
  // Which sort you read the board in is a habit, not something to re-pick on
  // every visit — so it follows the account, cached here for the first paint.
  const [boardSort, setBoardSort] = useStoredPreference(
    BOARD_SORT_STORAGE_KEY,
    DEFAULT_BOARD_SORT,
    isValidBoardSort
  );
  const [exportPeriod, setExportPeriod] = useState(DEFAULT_EXPORT_PERIOD);

  const isMobile = useIsMobile();
  const effectiveViewMode = isMobile ? 'list' : viewMode;
  const isBoard = effectiveViewMode === 'board';

  const hasHydratedFromParamsRef = useRef(false);
  const navigate = useNavigate();
  const overrideWorkspaceId = searchParams.get('workspaceId') || undefined;
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { data: overrideWorkspace } = useWorkspace(overrideWorkspaceId);

  const effectiveWorkspaceId = overrideWorkspaceId || user?.workspaceId;

  useEffect(() => {
    if (!socket || !isConnected || !effectiveWorkspaceId) return undefined;

    const workspaceId = String(effectiveWorkspaceId);
    socket.emit('join_workspace', { workspaceId });

    return () => {
      if (user?.workspaceId && String(user.workspaceId) === workspaceId) return;
      socket.emit('leave_workspace', { workspaceId });
    };
  }, [socket, isConnected, effectiveWorkspaceId, user?.workspaceId]);

  const [focusCommentId, setFocusCommentId] = useState(null);
  const [focusRequestToken, setFocusRequestToken] = useState(null);

  const { helpers, isLoading: statusesLoading } = useTicketStatuses(effectiveWorkspaceId);
  const allowedTabKeys = useMemo(
    () => helpers.statusTabs.map((tab) => tab.key),
    [helpers.statusTabs]
  );

  useEffect(() => {
    if (allowedTabKeys.length > 0 && !allowedTabKeys.includes(activeTab)) {
      setActiveTab('all');
    }
  }, [allowedTabKeys, activeTab]);

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

  const isValidTicketParam = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

  const handleCloseTicketDetails = useMemo(
    () => () => {
      isClosingDetailsRef.current = true;
      const next = new URLSearchParams(searchParams);
      if (next.has('ticket')) {
        next.delete('ticket');
      }
      if (next.has('comment')) {
        next.delete('comment');
      }
      if (next.has('focus')) {
        next.delete('focus');
      }
      setSearchParams(next, { replace: true });
      closeTicketDetails();
      setFocusCommentId(null);
      setFocusRequestToken(null);
    },
    [closeTicketDetails, searchParams, setSearchParams]
  );

  const handleFocusConsumed = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    if (!next.has('focus')) return;
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const tid = searchParams.get('ticket');
    const cid = searchParams.get('comment');
    const focusToken = searchParams.get('focus');
    setFocusCommentId(isValidTicketParam(cid) ? cid : null);
    setFocusRequestToken(focusToken || null);

    if (!isValidTicketParam(tid)) {
      // URL is cleaned, allow normal modal opening again.
      if (!tid) isClosingDetailsRef.current = false;
      setFocusCommentId(null);
      setFocusRequestToken(null);
      return;
    }
    if (isClosingDetailsRef.current) return;
    if (isDetailsOpen && selectedTicketId === tid) return;
    openTicketDetails(tid);
  }, [searchParams, openTicketDetails, isDetailsOpen, selectedTicketId]);

  useEffect(() => {
    if (!hasHydratedFromParamsRef.current) return;
    if (!isDetailsOpen || !selectedTicketId) return;
    if (searchParams.get('ticket') === selectedTicketId) return;
    const next = new URLSearchParams(searchParams);
    next.set('ticket', selectedTicketId);
    setSearchParams(next, { replace: true });
  }, [isDetailsOpen, selectedTicketId, searchParams, setSearchParams]);

  useTicketModalTitle({ ticketId: selectedTicketId, isOpen: isDetailsOpen });

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
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

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'n') {
        e.preventDefault();
        openNewTicket();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDetailsOpen, isNewOpen, handleCloseTicketDetails, closeNewTicket, openNewTicket]);

  const listStatusFilter = activeTab === 'all' ? 'not_null' : activeTab;

  const queryClient = useQueryClient();
  const updateTicketMutation = useUpdateTicket();

  const assigneeOptions = useMemo(
    () => buildAssigneeFilterOptions(usersData?.users || []),
    [usersData?.users]
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
          }
    );
  }, [initialTicketIdSort, setControls]);

  // Seed the assignee filter from the URL exactly once, unlike the sort above.
  // The sort re-applies whenever its param changes; this must not, or clearing
  // the "Assigned: …" chip would immediately snap back — the sync effect below
  // rewrites the param from the controls, which would re-trigger this.
  const hasSeededAssigneeRef = useRef(false);
  useEffect(() => {
    if (hasSeededAssigneeRef.current) return;
    // Wait for the user before resolving `me`; resolving it to nothing would
    // seed an empty filter and mark the seed done.
    if (initialAssigneeRaw === ASSIGNEE_SELF && !user?._id) return;
    hasSeededAssigneeRef.current = true;

    const ids = initialAssigneeRaw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => (value === ASSIGNEE_SELF ? user?._id : value))
      .filter(Boolean);

    if (ids.length === 0) return;
    setControls((prev) => ({ ...prev, assigneeIds: ids }));
  }, [initialAssigneeRaw, user?._id, setControls]);

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

  const statusCountsParams = getTicketsQueryParams({
    page: 1,
    workspaceId: effectiveWorkspaceId,
  }).board;

  const { data: statusCountsData } = useTickets(statusCountsParams, {
    enabled: !isBoard && !!effectiveWorkspaceId,
  });

  const statusTabCounts = useMemo(() => {
    const rawTickets = statusCountsData?.data || [];
    const counts = { all: rawTickets.length };
    for (const ticket of rawTickets) {
      const slug = extractStatusSlug(ticket.status).toLowerCase();
      if (!slug) continue;
      counts[slug] = (counts[slug] || 0) + 1;
    }
    return counts;
  }, [statusCountsData]);

  const statusTabsWithCounts = useMemo(
    () =>
      helpers.statusTabs.map((tab) => ({
        ...tab,
        color: tab.key === 'all' ? null : helpers.getStatusColor(tab.key),
        count: statusTabCounts[tab.key] ?? 0,
      })),
    [helpers, statusTabCounts]
  );

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch] = useDebounce(search, 500);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (hasHydratedFromParamsRef.current) return;
    listData.setSearch(initialSearch);
    listData.setPage(initialPage);
    hasHydratedFromParamsRef.current = true;
  }, [initialSearch, initialPage, listData]);

  const listTickets = listData.tickets;
  const pagination = listData.pagination;
  const isLoading = listData.isLoading;
  const isError = listData.isError;
  const isPlaceholderData = listData.isPlaceholderData;

  const timeSpentTick = useTimeSpentTicker(listTickets, helpers.statusTracksTime);

  const listColumns = useMemo(
    () =>
      createTicketColumns({
        statusBadgeConfig: helpers.statusBadgeConfig,
        statusIsDone: helpers.statusIsDone,
        statusTracksTime: helpers.statusTracksTime,
        hiddenColumns: ['totalTimeSpent'],
      }),
    [helpers, timeSpentTick]
  );

  const runWithListReset =
    (callback) =>
    (...args) => {
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

    if (activeTab === 'all') {
      next.delete('tab');
    } else {
      next.set('tab', encodeTabParam(activeTab));
    }

    if (search.trim()) {
      next.set('search', search.trim());
    } else {
      next.delete('search');
    }

    if (listData.page > 1) {
      next.set('page', String(listData.page));
    } else {
      next.delete('page');
    }

    if (effectiveViewMode === 'board') {
      next.set('view', 'board');
    } else {
      next.delete('view');
    }

    if (controls.ticketIdOrder !== TICKET_ID_ORDER_VALUES.NONE) {
      next.set(URL_TICKET_ID_SORT_PARAM, controls.ticketIdOrder);
    } else {
      next.delete(URL_TICKET_ID_SORT_PARAM);
    }

    // Written back so the filter survives a refresh and the URL stays shareable.
    // The caller's own id collapses back to `me`, which keeps the dashboard's
    // link stable and readable rather than growing an id the moment it is used.
    if (controls.assigneeIds.length > 0) {
      next.set(
        URL_ASSIGNEE_PARAM,
        controls.assigneeIds.map((id) => (id === user?._id ? ASSIGNEE_SELF : id)).join(',')
      );
    } else {
      next.delete(URL_ASSIGNEE_PARAM);
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
    controls.assigneeIds,
    user?._id,
    searchParams,
    setSearchParams,
  ]);

  const handleStatusChange = (ticketId, columnId) => {
    const statusId = helpers.resolveStatusFromColumnId(columnId);
    if (!statusId) return;

    updateTicketMutation.mutate(
      {
        ticketId,
        updates: { statusId },
      },
      {
        onSuccess: () => {
          invalidateWorkspaceTicketsScope(queryClient, effectiveWorkspaceId);
        },
        onError: (err) => console.error('Error updating ticket: ', err),
      }
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
      'title',
      'description',
      'status',
      'assignee',
      'createdAt',
      'updatedAt',
      'dueDate',
    ];
    const rows = tickets.map((ticket) => {
      const raw = ticket.raw || ticket;
      const subject = raw.subject || ticket.title || '';
      const description = raw.description || ticket.description || '';
      const status =
        helpers.resolveStatusLabel(ticket.statusMeta ?? raw.status) ||
        helpers.resolveStatusLabel(ticket.status);
      const assignee =
        (raw.assignedTo || [])
          .map((person) => person?.fullname || person?.fullName || person?.email || '')
          .filter(Boolean)
          .join('; ') || 'Unassigned';
      const createdAt = formatCsvDate(raw.createdAt);
      const updatedAt = formatCsvDate(raw.updatedAt);
      const dueDate = raw.dueDate || raw.due || '';
      return [subject, description, status, assignee, createdAt, updatedAt, dueDate];
    });
    return buildCsv(header, rows);
  };

  const downloadCsv = (csvString, period = exportPeriod) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const tabSlug = activeTab === 'all' ? 'all' : encodeTabParam(activeTab);
    const periodSlug = getExportPeriodFilenameSuffix(period);
    downloadCsvFile(`tickets-${tabSlug}-${periodSlug}-${stamp}.csv`, csvString);
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);

      let ticketsForExport = listTickets;
      const exportParams = {
        ...getTicketsQueryParams({
          page: 1,
          search: currentSearch,
          activeTab,
          archived: false,
          status: listStatusFilter,
          workspaceId: overrideWorkspaceId,
          queryFilters,
          listLimit: Math.max(isBoard ? 10000 : listData.pagination?.total || 0, 1),
        }).list,
        ...buildExportPeriodQueryParam(exportPeriod),
      };
      const response = await getAllTicketsApi(exportParams);
      ticketsForExport = (response?.data || []).map((ticket) => normalizeTicket(ticket));

      if (!ticketsForExport.length) {
        toast.info('No tickets to export for the selected filters and time period.');
        return;
      }

      const csv = toCsvRows(ticketsForExport);
      downloadCsv(csv);
      toast.success('Tickets exported to CSV.');
    } catch (error) {
      toast.error('Failed to export tickets. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageShell>
      {overrideWorkspaceId && (
        <PageSection className="pb-0">
          <div className="app-card flex items-center gap-3 px-5 py-3 text-sm text-[hsl(var(--tone-info-fg))]">
            <Building2 className="h-4 w-4 shrink-0" />
            <span>
              Viewing workspace: <strong>{overrideWorkspace?.name ?? overrideWorkspaceId}</strong>
            </span>
            <button
              onClick={() => navigate(`/admin/workspaces/${overrideWorkspaceId}`)}
              className="ml-auto flex items-center gap-1 text-xs text-[hsl(var(--tone-info-fg))] hover:underline"
              data-test="ticket-workspace-back-link"
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
        initialStatus={initialStatus ?? helpers.defaultMainStatusId}
        workspaceId={overrideWorkspaceId}
        statusOptions={helpers.statusOptions}
      />

      <TicketsHeader
        title="Tickets"
        subtitle="Track every ticket across statuses, assignees, and priorities."
        viewMode={effectiveViewMode}
        onViewModeChange={changeViewMode}
        search={currentSearch}
        onSearch={handleSearchChange}
        onNewTicket={openNewTicket}
        searchInputRef={searchInputRef}
        hideViewMode={isMobile}
      />

      {!statusesLoading ? (
        <TicketsTabs
          activeTab={activeTab}
          statusTabs={statusTabsWithCounts}
          onChange={(tabKey) => {
            setActiveTab(tabKey);
            listData.setPage(1);
          }}
          // The board filters by column, so the status tabs there only restated
          // the columns while squeezing the controls out of the band. The list
          // keeps them — they are its only status filter.
          showTabs={!isBoard}
          rightSlot={
            <div className="flex items-center gap-2" data-test="ticket-tabs-controls">
              <TicketFiltersPanel {...ticketFiltersPanelProps} activeFilterChips={[]} />
              {!isBoard ? (
                <TicketExportMenu
                  exportPeriod={exportPeriod}
                  onExportPeriodChange={setExportPeriod}
                  onExportCsv={handleExportCsv}
                  isExporting={isExporting}
                />
              ) : null}
            </div>
          }
        />
      ) : null}

      {isBoard ? (
        // Bleeds to the band's 24px gutter so the columns line up with the tab
        // band and the page header above them, as in the mockup.
        <PageSection className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
          {/* The mockup's board grid padding: 14px 24px 20px. */}
          <div className="-mx-6 flex min-h-0 flex-1 flex-col px-6 pt-3.5">
            <Suspense fallback={<TableSkeleton />}>
              <BoardPage
                fetchMode="all"
                workspaceId={effectiveWorkspaceId}
                search={debouncedSearch}
                queryFilters={queryFilters}
                enabled={isBoard && !!effectiveWorkspaceId}
                statusesLoading={statusesLoading}
                onNewTicket={openNewTicket}
                onOpenTicket={openTicketDetails}
                onStatusChange={handleStatusChange}
                boardHelpers={helpers}
                sortKey={boardSort}
              />
            </Suspense>
          </div>
        </PageSection>
      ) : (
        // Flush, not a card. In the mockup the rows run the full width of the
        // content column under the tab band — a rounded panel around them put a
        // second frame inside the page's own, and pulled the row gutter off the
        // 24px the header and band both use.
        <PageSection className="flex-1 py-0">
          <div className={cn('-mx-6 bg-card', isPlaceholderData && 'opacity-60')}>
            <TicketsState
              isLoading={isLoading}
              isError={isError}
              isEmpty={!isLoading && !isError && listTickets.length === 0}
              emptyMessage="No tickets found."
              loadingSlot={<TableSkeleton />}
            >
              <DataTable
                columns={listColumns}
                data={listTickets}
                pagination={pagination}
                onPageChange={(newPage) => listData.setPage(newPage)}
                meta={{ onRowClick: openTicketDetails }}
              />
            </TicketsState>
          </div>
        </PageSection>
      )}

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={handleCloseTicketDetails}
        focusCommentId={focusCommentId}
        focusRequestToken={focusRequestToken}
        onFocusConsumed={handleFocusConsumed}
      />
    </PageShell>
  );
}
