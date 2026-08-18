import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { LegacyDataTable } from '@/components/dashboard/legacy/LegacyTicketsTable';
import { createLegacyTicketColumns } from '@/components/dashboard/legacy/legacyTicketColumns';
import { useMyTickets } from '@/queries/tickets';
import { normalizeTicket } from '@/helpers/normalizeTicket';
import LegacyTicketsState from '@/components/dashboard/legacy/LegacyTicketsState';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
// The dashboard keeps the pre-overhaul header and table verbatim — see
// components/dashboard/legacy/. Nothing here follows the overhauled Tickets list.
import LegacyTicketsHeader from '@/components/dashboard/legacy/LegacyTicketsHeader';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import { useTicketModals } from '@/hooks/useTicketModals';
import { useTicketModalTitle } from '@/hooks/useTicketModalTitle';
import { useDebounce } from 'use-debounce';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUpdateTicket } from '@/queries/tickets';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useTimeSpentTicker } from '@/hooks/useTimeSpentTicker';
import { useAuth } from '@/context/AuthContext';
import { PageSection, PageShell } from '@/components/PageShell';
import DashboardCheckInReminder from '@/components/attendance/DashboardCheckInReminder';

const BoardPage = lazy(() => import('@/components/BoardPage'));

/**
 * The assigned-tickets table — the mentor's `/dashboard`.
 *
 * Admins get `AdminDashboardPage` and interns get `InternDashboardPage`; this is
 * what is left. The intern board reaches the same data through
 * `/tickets?assignee=me` instead, so there is no second mount of this page.
 */
export default function UserDashboard() {
  const [requestedPage, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();
  const [debouncedSearch] = useDebounce(search, 500);
  const updateTicketMutation = useUpdateTicket();
  const { user } = useAuth();
  const { helpers, isLoading: statusesLoading } = useTicketStatuses(user?.workspaceId);

  const { selectedTicketId, isDetailsOpen, openTicketDetails, closeTicketDetails } =
    useTicketModals();
  useTicketModalTitle({ ticketId: selectedTicketId, isOpen: isDetailsOpen });

  const isBoard = viewMode === 'board';

  const {
    data: ticketsData,
    isLoading,
    isError,
  } = useMyTickets(
    {
      page: requestedPage,
      limit: 10,
      search: debouncedSearch,
      status: 'not_null',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      workspaceId: user?.workspaceId,
    },
    { enabled: !!user?.workspaceId && !isBoard }
  );

  const pagination = ticketsData?.pagination;

  useEffect(() => {
    if (pagination && pagination.page > pagination.pages && pagination.pages > 0) {
      setPage(pagination.pages);
    }
  }, [pagination]);

  const normalizedTickets = useMemo(() => {
    return (ticketsData?.data || []).map((ticket) => normalizeTicket(ticket));
  }, [ticketsData]);

  const timeSpentTick = useTimeSpentTicker(normalizedTickets, helpers.statusTracksTime);

  const columns = useMemo(
    () =>
      createLegacyTicketColumns({
        statusBadgeConfig: helpers.statusBadgeConfig,
        statusIsDone: helpers.statusIsDone,
        statusTracksTime: helpers.statusTracksTime,
        onOpenTicket: openTicketDetails,
      }),
    [helpers, timeSpentTick, openTicketDetails]
  );

  const handleStatusChange = (ticketId, columnId) => {
    const statusId = helpers.resolveStatusFromColumnId(columnId);
    if (!statusId) return;

    updateTicketMutation.mutate(
      {
        ticketId: ticketId,
        updates: { statusId },
      },
      {
        onSuccess: () => {},
        onError: () => {},
      }
    );
  };

  useEffect(() => {
    if (isMobile && viewMode === 'board') {
      setViewMode('list');
    }
  }, [isMobile, viewMode]);

  return (
    <PageShell>
      <div className="shrink-0">
        <LegacyTicketsHeader
          title="Dashboard"
          subtitle="Track your assigned tickets"
          hideNewTicket={true}
          dataTestPrefix="dashboard"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hideViewMode={isMobile}
          search={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      </div>

      <DashboardCheckInReminder className="app-page-content shrink-0 !pb-0 !pt-4" />

      {!isMobile && isBoard ? (
        <PageSection className="flex min-h-0 flex-1 flex-col overflow-hidden pb-4 pt-4">
          <Suspense fallback={<TableSkeleton />}>
            <BoardPage
              fetchMode="my"
              workspaceId={user?.workspaceId}
              search={debouncedSearch}
              enabled={!!user?.workspaceId}
              statusesLoading={statusesLoading}
              onOpenTicket={openTicketDetails}
              onStatusChange={handleStatusChange}
              boardHelpers={helpers}
            />
          </Suspense>
        </PageSection>
      ) : (
        <PageSection className="flex-1 pt-4">
          <div className="app-panel overflow-hidden">
            <LegacyTicketsState
              isLoading={isLoading}
              isError={isError}
              isEmpty={!isLoading && !isError && normalizedTickets.length === 0}
              emptyMessage="No tickets assigned to you found."
              loadingSlot={<TableSkeleton />}
            >
              <LegacyDataTable
                columns={columns}
                data={normalizedTickets}
                pagination={pagination}
                onPageChange={(newPage) => setPage(newPage)}
                meta={{ onRowClick: openTicketDetails }}
              />
            </LegacyTicketsState>
          </div>
        </PageSection>
      )}

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
        onOpenTicket={openTicketDetails}
      />
    </PageShell>
  );
}
