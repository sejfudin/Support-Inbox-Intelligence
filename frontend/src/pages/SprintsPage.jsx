import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarRange, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCurrentSprint, useSprints } from '@/queries/sprints';
import { useUpdateTicket } from '@/queries/tickets';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useTicketModals } from '@/hooks/useTicketModals';
import { invalidateWorkspaceTicketsScope } from '@/lib/invalidationScopes';
import { CreateSprintModal } from '@/components/sprints/CreateSprintModal';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import EmptyState from '@/components/EmptyState';
import BoardSkeleton from '@/components/Skeletons/BoardSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { Loader, LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

const BoardPage = lazy(() => import('@/components/BoardPage'));

// upcoming/active/past mirror server/helpers/sprintRules.js's SPRINT_STATES —
// duplicated here as display data rather than imported across the client/server
// boundary.
const STATE_BADGE = {
  active: { label: 'Active', tone: 'success' },
  upcoming: { label: 'Upcoming', tone: 'info' },
  past: { label: 'Past', tone: 'muted' },
};

const formatDateRange = (start, end) =>
  `${format(new Date(start), 'MMM d')} – ${format(new Date(end), 'MMM d')}`;

const SprintHeaderBand = ({ sprint, onCreateClick }) => {
  const badge = STATE_BADGE[sprint.state] ?? STATE_BADGE.active;
  const subtitleParts = [formatDateRange(sprint.start, sprint.end), sprint.goal].filter(Boolean);

  return (
    <PageHeading
      crumb="Workspace · Sprints"
      title={sprint.name}
      titleAdornment={
        <Badge tone={badge.tone}>
          {sprint.state === 'upcoming'
            ? `Starts ${format(new Date(sprint.start), 'MMM d')}`
            : badge.label}
        </Badge>
      }
      subtitle={subtitleParts.join(' · ')}
      actions={
        <Button onClick={onCreateClick} data-test="sprint-new-button">
          <Plus className="h-4 w-4" />
          New sprint
        </Button>
      }
    />
  );
};

const SprintsPage = () => {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId;
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: currentResponse, isLoading: isLoadingRaw, isError } = useCurrentSprint(workspaceId);
  const { data: sprintsResponse } = useSprints(workspaceId);
  const isLoading = useLoaderHold(isLoadingRaw, { release: isError });

  const sprint = currentResponse?.data ?? null;
  const sprintId = sprint?._id ?? null;
  const nextSprintName = `Sprint ${(sprintsResponse?.data?.length ?? 0) + 1}`;

  const {
    helpers,
    isLoading: statusesLoading,
    isError: statusesError,
  } = useTicketStatuses(workspaceId);
  const { selectedTicketId, isDetailsOpen, openTicketDetails, closeTicketDetails } =
    useTicketModals();
  const updateTicketMutation = useUpdateTicket();

  // The sprint board is the ordinary board with one filter on it, so the columns
  // stay the workspace's own statuses in the workspace's own order.
  const queryFilters = useMemo(() => ({ sprintId }), [sprintId]);

  const handleStatusChange = useCallback(
    (ticketId, columnId) => {
      const statusId = helpers.resolveStatusFromColumnId(columnId);
      if (!statusId) return;

      updateTicketMutation.mutate(
        { ticketId, updates: { statusId } },
        {
          onSuccess: () => invalidateWorkspaceTicketsScope(queryClient, workspaceId),
          onError: (err) => console.error('Error updating ticket: ', err),
        }
      );
    },
    [helpers, updateTicketMutation, queryClient, workspaceId]
  );

  return (
    <PageShell>
      <PageSection className="flex flex-col gap-3.5">
        {sprint ? (
          <SprintHeaderBand sprint={sprint} onCreateClick={() => setIsCreateOpen(true)} />
        ) : (
          <PageHeading crumb="Workspace · Sprints" title="Sprints" />
        )}

        {isLoading ? (
          <Loader variant="panel" label="Loading sprint…" />
        ) : !sprint ? (
          <EmptyState
            icon={CalendarRange}
            title="No sprint yet"
            description="Create a sprint to give the team a window of committed work to plan against."
            action={
              <Button onClick={() => setIsCreateOpen(true)} data-test="sprint-empty-create">
                <Plus className="h-4 w-4" />
                Create sprint
              </Button>
            }
          />
        ) : (
          // Same board padding as the tickets board, which this is a filtered
          // view of. No `+` per column: a ticket created from a sprint column
          // would have to decide whether it joins the sprint, and the spec puts
          // every sprint write on the planning modal.
          <div className="-mx-6 flex min-h-0 flex-1 flex-col px-6 pt-1">
            <Suspense
              fallback={
                <LoadingOverlay label="Loading board">
                  <BoardSkeleton />
                </LoadingOverlay>
              }
            >
              <BoardPage
                fetchMode="all"
                workspaceId={workspaceId}
                queryFilters={queryFilters}
                enabled={!!workspaceId && !!sprintId}
                statusesLoading={statusesLoading}
                statusesError={statusesError}
                onOpenTicket={openTicketDetails}
                onStatusChange={handleStatusChange}
                boardHelpers={helpers}
              />
            </Suspense>
          </div>
        )}
      </PageSection>

      <CreateSprintModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        workspaceId={workspaceId}
        nextSprintName={nextSprintName}
      />

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
        onOpenTicket={openTicketDetails}
      />
    </PageShell>
  );
};

export default SprintsPage;
