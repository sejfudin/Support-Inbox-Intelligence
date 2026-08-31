import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, CalendarRange, Pencil, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCurrentSprint, useSprints } from '@/queries/sprints';
import { useBoardStatusMove } from '@/queries/tickets';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useTicketModals } from '@/hooks/useTicketModals';
import { SprintModal } from '@/components/sprints/SprintModal';
import { SprintProgressStrip } from '@/components/sprints/SprintProgressStrip';
import { PastSprintList } from '@/components/sprints/PastSprintList';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import EmptyState from '@/components/EmptyState';
import BoardSkeleton from '@/components/Skeletons/BoardSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { Loader, LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

const BoardPage = lazy(() => import('@/components/BoardPage'));

// Two tabs, and only two. The mockup's third `Backlog` tab was rejected: the
// existing Backlog page stays the one place the backlog lives.
const TABS = {
  SPRINT: 'sprint',
  PAST: 'past',
};

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

// The band carries BOTH actions, deliberately: planning the next sprint while
// one is running has to stay possible, so Edit never replaces New. Edit is
// dropped only for a past sprint, which is a record rather than a workspace —
// and `permissions.canEdit` is the server's answer to that, not a second rule
// derived here from the dates.
const SprintHeaderBand = ({ sprint, onCreateClick, onEditClick, tabs, backAction }) => {
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
      tabs={tabs}
      actions={
        <>
          {backAction}
          {sprint.permissions?.canEdit ? (
            <Button variant="outline" onClick={onEditClick} data-test="sprint-edit-button">
              <Pencil className="h-4 w-4" />
              Edit sprint
            </Button>
          ) : null}
          {onCreateClick ? (
            <Button onClick={onCreateClick} data-test="sprint-new-button">
              <Plus className="h-4 w-4" />
              New sprint
            </Button>
          ) : null}
        </>
      }
    />
  );
};

const SprintsPage = () => {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId;
  // One modal, two modes. `editingSprint` null means create; set means edit that
  // sprint, prefilled.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [tab, setTab] = useState(TABS.SPRINT);
  // Which past sprint's board is open, if any. Null means the Past tab is
  // showing its list.
  const [openPastSprintId, setOpenPastSprintId] = useState(null);

  const openCreate = () => {
    setEditingSprint(null);
    setIsModalOpen(true);
  };

  const { data: currentResponse, isLoading: isLoadingRaw, isError } = useCurrentSprint(workspaceId);
  const {
    data: sprintsResponse,
    isLoading: isLoadingSprintsRaw,
    isError: isSprintsError,
  } = useSprints(workspaceId);
  const isLoading = useLoaderHold(isLoadingRaw, { release: isError });
  const isLoadingSprints = useLoaderHold(isLoadingSprintsRaw, { release: isSprintsError });

  const currentSprint = currentResponse?.data ?? null;
  const nextSprintName = `Sprint ${(sprintsResponse?.data?.length ?? 0) + 1}`;

  // Newest first — the most recently finished sprint is the one somebody is
  // most likely to be looking for. State comes off the server, which is the one
  // place that decides what a sprint is (ADR 0010).
  const pastSprints = useMemo(
    () =>
      (sprintsResponse?.data ?? [])
        .filter((entry) => entry.state === 'past')
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()),
    [sprintsResponse]
  );

  const openPastSprint = useMemo(
    () => pastSprints.find((entry) => entry._id === openPastSprintId) ?? null,
    [pastSprints, openPastSprintId]
  );

  // Leaving the tab closes whatever past board was open, so coming back lands on
  // the list rather than on a board the person has forgotten they opened.
  useEffect(() => {
    if (tab !== TABS.PAST) setOpenPastSprintId(null);
  }, [tab]);

  // The sprint whose board is on screen: the current one on the Sprint tab, the
  // opened record on the Past tab.
  const shownSprint = tab === TABS.PAST ? openPastSprint : currentSprint;
  const isReadOnlyBoard = tab === TABS.PAST;
  const sprintId = shownSprint?._id ?? null;

  const {
    helpers,
    isLoading: statusesLoading,
    isError: statusesError,
  } = useTicketStatuses(workspaceId);
  const { selectedTicketId, isDetailsOpen, openTicketDetails, closeTicketDetails } =
    useTicketModals();
  const boardStatusMove = useBoardStatusMove();

  // The sprint board is the ordinary board with one filter on it, so the columns
  // stay the workspace's own statuses in the workspace's own order.
  const queryFilters = useMemo(() => ({ sprintId }), [sprintId]);

  // A drop on the sprint board, which is the ordinary board with a filter on it —
  // so the same optimistic move. `useBoardStatusMove` owns the rollback and the
  // error toast. A past (read-only) sprint never gets here: it passes
  // `onStatusChange={undefined}` and `BoardPage` guards on `readOnly` as well.
  const handleStatusChange = useCallback(
    (ticketId, columnId) => {
      const statusId = helpers.resolveStatusFromColumnId(columnId);
      if (!statusId) return;

      boardStatusMove.mutate({
        ticketId,
        statusId,
        statusDoc: helpers.resolveStatusDocFromColumnId(columnId),
        workspaceId,
      });
    },
    [helpers, boardStatusMove, workspaceId]
  );

  const tabStrip = (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value={TABS.SPRINT} data-test="sprints-tab-sprint">
          Sprint
        </TabsTrigger>
        <TabsTrigger value={TABS.PAST} data-test="sprints-tab-past">
          Past
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  // Same board padding as the tickets board, which this is a filtered view of.
  // No `+` per column: a ticket created from a sprint column would have to decide
  // whether it joins the sprint, and the spec puts every sprint write on the
  // planning modal.
  const board = (
    <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-3.5 px-6 pt-1">
      {/* Every number on the strip arrives on the sprint read, computed by the
          server's sprint-rules helper — and for a past sprint it is the SEALED
          number, so a leftover carried out of it afterwards cannot change what
          the sprint says it delivered (ADR 0012). */}
      <SprintProgressStrip sprint={shownSprint} />
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
          // A past sprint is frozen: the same board component with drag turned
          // off, and no status write wired to it at all.
          onStatusChange={isReadOnlyBoard ? undefined : handleStatusChange}
          readOnly={isReadOnlyBoard}
          boardHelpers={helpers}
        />
      </Suspense>
    </div>
  );

  const headerBand = shownSprint ? (
    <SprintHeaderBand
      sprint={shownSprint}
      tabs={tabStrip}
      // Nothing on a past sprint can be created FROM it either — the create
      // action belongs to the Sprint tab, where planning happens.
      onCreateClick={isReadOnlyBoard ? null : openCreate}
      onEditClick={() => {
        setEditingSprint(shownSprint);
        setIsModalOpen(true);
      }}
      backAction={
        isReadOnlyBoard ? (
          <Button
            variant="outline"
            onClick={() => setOpenPastSprintId(null)}
            data-test="past-sprint-back"
          >
            <ArrowLeft className="h-4 w-4" />
            All past sprints
          </Button>
        ) : null
      }
    />
  ) : (
    <PageHeading
      crumb="Workspace · Sprints"
      title={tab === TABS.PAST ? 'Past sprints' : 'Sprints'}
      tabs={tabStrip}
      actions={
        tab === TABS.PAST ? null : (
          <Button onClick={openCreate} data-test="sprint-new-button">
            <Plus className="h-4 w-4" />
            New sprint
          </Button>
        )
      }
    />
  );

  const sprintTabBody = isLoading ? (
    <Loader variant="panel" label="Loading sprint…" />
  ) : !currentSprint ? (
    <EmptyState
      icon={CalendarRange}
      title="No sprint yet"
      description="Create a sprint to give the team a window of committed work to plan against."
      action={
        <Button onClick={openCreate} data-test="sprint-empty-create">
          <Plus className="h-4 w-4" />
          Create sprint
        </Button>
      }
    />
  ) : (
    board
  );

  const pastTabBody = isLoadingSprints ? (
    <Loader variant="panel" label="Loading past sprints…" />
  ) : openPastSprint ? (
    board
  ) : (
    <PastSprintList sprints={pastSprints} onOpen={setOpenPastSprintId} />
  );

  return (
    <PageShell>
      <PageSection className="flex flex-col gap-3.5">
        {headerBand}
        {tab === TABS.PAST ? pastTabBody : sprintTabBody}
      </PageSection>

      <SprintModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        workspaceId={workspaceId}
        nextSprintName={nextSprintName}
        sprint={editingSprint}
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
