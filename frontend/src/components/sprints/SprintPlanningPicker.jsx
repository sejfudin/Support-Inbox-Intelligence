import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SearchField } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Switcher } from '@/components/ui/switcher';
import { useLoaderHold } from '@/components/ui/loader';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useTickets } from '@/queries/tickets';
import {
  SprintPlanningTicketCard,
  buildPlanningTicketView,
} from '@/components/sprints/SprintPlanningTicketCard';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 300;
// A workspace's whole unsprinted queue in one page — the mockup's list scrolls
// rather than paginates, and this is well past what any real backlog holds.
const SOURCE_TICKET_LIMIT = 500;

const SOURCE_PANE_ID = 'sprint-picker-source-pane';
const SPRINT_PANE_ID = 'sprint-picker-sprint-pane';

function Pane({ id, className, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'ring-2 ring-primary/30')}>
      {children}
    </div>
  );
}

/**
 * The create/edit sprint modal's two-pane picker (ticket 03). Fully controlled
 * on `selectedIds` so the modal owns what gets written in the single bulk
 * membership request on save.
 *
 * `extraTickets` is how edit mode works: the sprint's own tickets are not in the
 * unsprinted query — they are, by definition, sprinted — so the modal fetches
 * them and hands them in. They then behave like any other card, which is what
 * makes "drag one back to the left" remove it from a running sprint.
 */
export function SprintPlanningPicker({
  workspaceId,
  selectedIds,
  onSelectedIdsChange,
  extraTickets = [],
}) {
  const { helpers } = useTicketStatuses(workspaceId);
  const hasBacklogStatus = Boolean(helpers.backlogStatusId);

  const [sourceTab, setSourceTab] = useState(hasBacklogStatus ? 'backlog' : 'tickets');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);
  const [activeTicket, setActiveTicket] = useState(null);

  useEffect(() => {
    if (!hasBacklogStatus && sourceTab === 'backlog') setSourceTab('tickets');
  }, [hasBacklogStatus, sourceTab]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const ticketsQuery = useTickets(
    {
      workspaceId,
      unsprinted: true,
      archived: false,
      search: debouncedSearch,
      limit: SOURCE_TICKET_LIMIT,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },
    { enabled: Boolean(workspaceId) }
  );
  const isLoadingTickets = useLoaderHold(ticketsQuery.isLoading, {
    release: ticketsQuery.isError,
  });

  const ticketsById = useMemo(() => {
    const map = new Map();
    // The sprint's own tickets first, so a fresher copy from the unsprinted
    // query wins if a ticket somehow appears in both.
    [...extraTickets, ...(ticketsQuery.data?.data || [])].forEach((ticket) => {
      const view = buildPlanningTicketView(ticket);
      map.set(view.id, view);
    });
    return map;
  }, [ticketsQuery.data, extraTickets]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const sourceTickets = useMemo(() => {
    const wantBacklog = sourceTab === 'backlog';
    return Array.from(ticketsById.values()).filter(
      (ticket) => !selectedIdSet.has(ticket.id) && ticket.isBacklog === wantBacklog
    );
  }, [ticketsById, selectedIdSet, sourceTab]);

  const sprintTickets = useMemo(
    () => selectedIds.map((id) => ticketsById.get(id)).filter(Boolean),
    [selectedIds, ticketsById]
  );

  const totalPoints = sprintTickets.reduce((sum, ticket) => sum + (ticket.storyPoints || 0), 0);

  const addToSprint = (ticket) => {
    if (ticket.storyPoints == null) return;
    if (selectedIdSet.has(ticket.id)) return;
    onSelectedIdsChange([...selectedIds, ticket.id]);
  };

  const removeFromSprint = (ticketId) => {
    onSelectedIdsChange(selectedIds.filter((id) => id !== ticketId));
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTicket(null);
    if (!over) return;

    const ticket = active.data.current?.ticket;
    if (!ticket) return;

    if (over.id === SPRINT_PANE_ID) addToSprint(ticket);
    else if (over.id === SOURCE_PANE_ID) removeFromSprint(ticket.id);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={(event) => setActiveTicket(event.active.data.current?.ticket ?? null)}
      onDragCancel={() => setActiveTicket(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-2 overflow-hidden rounded-[var(--r-card)] border border-border">
        <div className="flex flex-col gap-2.5 border-r border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Switcher
              label="Ticket source"
              value={sourceTab}
              onChange={setSourceTab}
              items={[
                { value: 'backlog', label: 'Backlog', disabled: !hasBacklogStatus },
                { value: 'tickets', label: 'Tickets' },
              ]}
            />
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search tickets..."
              width="default"
            />
          </div>

          {!hasBacklogStatus ? (
            <p className="text-[11px] text-muted-foreground">
              This workspace has no backlog status set up, so there is nothing to plan from there.
            </p>
          ) : null}

          <Pane
            id={SOURCE_PANE_ID}
            className="flex h-[320px] flex-col gap-2 overflow-y-auto rounded-[var(--r-tile)]"
          >
            {isLoadingTickets ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[var(--r-tile)] border border-separator p-2.5"
                  >
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </div>
                ))}
              </div>
            ) : ticketsQuery.isError ? (
              <p className="py-6 text-center text-[12px] text-muted-foreground">
                Failed to load tickets.
              </p>
            ) : sourceTickets.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-muted-foreground">
                {debouncedSearch ? 'No tickets match your search.' : 'Nothing to show here.'}
              </p>
            ) : (
              sourceTickets.map((ticket) => (
                <SprintPlanningTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  workspaceId={workspaceId}
                />
              ))
            )}
          </Pane>
        </div>

        <div className="flex flex-col gap-2.5 bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">In this sprint</span>
            <span className="text-[11.5px] text-muted-foreground">
              {sprintTickets.length} {sprintTickets.length === 1 ? 'ticket' : 'tickets'} ·{' '}
              {totalPoints} pts
            </span>
          </div>

          <Pane
            id={SPRINT_PANE_ID}
            className={cn(
              'flex h-[320px] flex-col gap-2 overflow-y-auto rounded-[var(--r-tile)]',
              sprintTickets.length === 0 && 'border border-dashed border-border'
            )}
          >
            {sprintTickets.length === 0 ? (
              <p className="flex flex-1 items-center justify-center text-center text-[12px] text-muted-foreground">
                Drag tickets here to add them to the sprint.
              </p>
            ) : (
              sprintTickets.map((ticket) => (
                <SprintPlanningTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onRemove={removeFromSprint}
                />
              ))
            )}
          </Pane>
        </div>
      </div>

      {/* Portalled to `body`: dnd-kit positions `DragOverlay` with `position: fixed`,
          and the Dialog's own open/centering transform turns that into "fixed to the
          dialog" instead of the viewport, so the dragged card drifted off the cursor. */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeTicket ? (
            <div className="pointer-events-none w-[260px] cursor-grabbing touch-none">
              <SprintPlanningTicketCard ticket={activeTicket} dragDisabled />
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

export default SprintPlanningPicker;
