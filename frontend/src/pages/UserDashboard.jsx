import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/Tickets/TicketsTable';
import { createTicketColumns } from '@/components/columns/ticketColumns';
import { useMyTickets } from '@/queries/tickets';
import { normalizeTicket } from '@/helpers/normalizeTicket';
import TicketsState from '@/components/Tickets/TicketsState';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import TicketsHeader from '@/components/Tickets/TicketsHeader';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import { useTicketModals } from '@/hooks/useTicketModals';
import { useDebounce } from 'use-debounce';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUpdateTicket } from '@/queries/tickets';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useTimeSpentTicker } from '@/hooks/useTimeSpentTicker';
import { useAuth } from '@/context/AuthContext';

const BoardPage = lazy(() => import('@/components/BoardPage'));

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
    { enabled: !!user?.workspaceId }
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
      createTicketColumns({
        statusBadgeConfig: helpers.statusBadgeConfig,
        statusIsDone: helpers.statusIsDone,
        statusTracksTime: helpers.statusTracksTime,
      }),
    [helpers, timeSpentTick]
  );

  const isBoard = viewMode === 'board';

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
    <main className="app-page flex min-h-screen flex-col font-sans">
      <TicketsHeader
        title="Dashboard"
        subtitle="Track your assigned tickets"
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
          <div className="app-page-content mt-2">
            {!isMobile && isBoard ? (
              <Suspense fallback={<TableSkeleton />}>
                <BoardPage
                  tickets={normalizedTickets}
                  isLoading={isLoading || statusesLoading}
                  isError={isError}
                  onOpenTicket={openTicketDetails}
                  onStatusChange={handleStatusChange}
                  boardHelpers={helpers}
                  flush
                />
              </Suspense>
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
                      pagination={pagination}
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
