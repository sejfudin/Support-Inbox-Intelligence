import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';

import { PR_STATE_CONFIG } from '@/components/PRCard';
import PriorityIndicator from '@/components/PriorityIndicator';
import AssigneesAvatar from '@/components/Tickets/AssigneesAvatar';
import BlockedByChip from '@/components/Tickets/BlockedByChip';
import TicketReviewChip from '@/components/Tickets/TicketReviewChip';
import BoardSkeleton from '@/components/Skeletons/BoardSkeleton';
import { BOARD_COLUMN_QUERY_KEY } from '@/queries/boardTickets';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { getColumnStyle } from '@/helpers/ticketStatus';
import { useThemeConfig } from '@/context/ThemeConfigContext';
import { sortBoardTasksByPriorityOrder } from '@/helpers/boardTicketsQuery';
import { DEFAULT_BOARD_SORT, sortBoardCards } from '@/helpers/boardCardSort';
import { normalizeTicket } from '@/helpers/normalizeTicket';
import { cn } from '@/lib/utils';
import { useBoardColumnTickets } from '@/queries/boardTickets';
import { Loader, LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

// Category chip tints, per the mockup: Bug → error, Feature → info, Refactor →
// primary tint, Fix → warning. Status tokens don't exist in this app's palette, so
// these follow the documented exception — a Tailwind step WITH a dark variant.
const CATEGORY_TONE = {
  bug: 'bg-[hsl(var(--tone-danger)/0.15)] text-[hsl(var(--tone-danger-fg))] dark:bg-[hsl(var(--tone-danger)/0.15)] dark:text-[hsl(var(--tone-danger-fg))]',
  feature:
    'bg-[hsl(var(--tone-info)/0.15)] text-[hsl(var(--tone-info-fg))] dark:bg-[hsl(var(--tone-info)/0.15)] dark:text-[hsl(var(--tone-info-fg))]',
  refactor: 'bg-primary/10 text-primary',
  fix: 'bg-[hsl(var(--tone-warning)/0.15)] text-[hsl(var(--tone-warning-fg))] dark:bg-[hsl(var(--tone-warning)/0.15)] dark:text-[hsl(var(--tone-warning-fg))]',
};

const categoryTone = (label) =>
  CATEGORY_TONE[
    String(label || '')
      .trim()
      .toLowerCase()
  ] || 'bg-muted text-muted-foreground';

function formatDueLabel(dueDate) {
  if (!dueDate) return '';
  try {
    const d = dueDate instanceof Date ? dueDate : new Date(dueDate);
    if (Number.isNaN(d.getTime())) return '';
    return format(d, 'MMM d, yyyy');
  } catch {
    return '';
  }
}

function buildBoardTaskView(ticket, boardHelpers) {
  const normalized = normalizeTicket(ticket);
  const colId = boardHelpers.resolveBoardColumnId(normalized.status);
  const category = ticket.category;
  const categoryLabel =
    category && typeof category === 'object' ? String(category.name || '').trim() : '';

  return {
    id: normalized.id,
    title: normalized.title,
    priority: normalized.priority,
    dueLabel: formatDueLabel(normalized.dueDate),
    assignedTo: normalized.assignedTo,
    taskNumber: normalized.taskNumber,
    storyPoints: normalized.storyPoints,
    categoryLabel,
    linkedPullRequest: ticket.linkedPullRequest || null,
    blockingTicket: ticket.blockedBy?.ticket || null,
    reviewRequest: ticket.reviewRequest || null,
    columnId: colId,
    updatedAt: ticket.updatedAt ?? null,
    // Raw values the board sort needs — `dueLabel` above is display-only, and a
    // formatted date sorts alphabetically, which is not a date order.
    dueDate: normalized.dueDate ?? null,
    createdAt: ticket.createdAt ?? null,
  };
}

/**
 * A board card, 1:1 with the mockup: `#id` and the points chip on one line with
 * the category chip pushed right, the title under them, then priority / due /
 * assignee on the base line. 10px radius and a single hairline — the pre-overhaul
 * card used a 2px status-coloured border and shadcn's 16px `--radius`, which is
 * what made the board read as a stack of lozenges.
 */
const BoardTaskCardBody = memo(function BoardTaskCardBody({
  task,
  onOpen,
  cardClassName,
  compact = false,
}) {
  const pr = task.linkedPullRequest;
  const prLabel = pr && typeof pr === 'object' && pr.prNumber != null ? `#${pr.prNumber}` : '';
  const prStateConfig = pr?.state ? PR_STATE_CONFIG[pr.state] : null;
  const PrStateIcon = prStateConfig?.icon;
  const hasStoryPoints = task.storyPoints != null && task.storyPoints !== '';

  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      data-test={`board-task-${task.id}-card`}
      className={cn(
        'flex w-full cursor-pointer flex-col gap-2 rounded-[var(--r-tile)] border border-separator bg-card p-2.5 text-left',
        !compact && 'hover:border-border hover:bg-accent/50',
        cardClassName
      )}
    >
      {/* 1 — meta: id, points, then the category chip flush right */}
      <span className="flex min-w-0 items-center gap-1.5">
        {task.taskNumber != null && task.taskNumber !== '' && (
          <span className="flex-none text-[10.5px] font-semibold tabular-nums text-muted-foreground/75">
            #{task.taskNumber}
          </span>
        )}
        {hasStoryPoints ? (
          <span className="flex-none rounded-[5px] bg-muted px-1.5 py-px text-[10.5px] font-semibold text-muted-foreground">
            {task.storyPoints} pts
          </span>
        ) : null}
        {/* `onOpen` is "open ticket details for this id", so the chip reuses it to
            open the blocker. It stops the click reaching the card underneath. */}
        <BlockedByChip blocker={task.blockingTicket} onOpenTicket={onOpen} className="flex-none" />
        <TicketReviewChip reviewRequest={task.reviewRequest} className="flex-none" />
        <span className="min-w-0 flex-1" />
        {prLabel && prStateConfig ? (
          <span
            className={cn(
              'flex flex-none items-center gap-0.5 rounded-[5px] px-1.5 py-px text-[10px] font-semibold',
              prStateConfig.className
            )}
          >
            {PrStateIcon ? <PrStateIcon className="h-3 w-3" aria-hidden /> : null}
            {prLabel}
          </span>
        ) : null}
        {task.categoryLabel ? (
          <span
            className={cn(
              'flex-none rounded-[5px] px-1.5 py-px text-[10px] font-semibold',
              categoryTone(task.categoryLabel)
            )}
          >
            {task.categoryLabel}
          </span>
        ) : null}
      </span>

      {/* 2 — title: a fixed two-line box, so every card in a column is the same
          height. The mockup lets the title wrap freely, which is fine at its
          210px column but leaves a ragged stack once the columns stretch and
          most titles fit on one line. Two lines is the height the mockup's own
          cards settle at; longer titles ellipsise and the full text is on the
          card's tooltip and in the ticket modal. */}
      <span
        className="line-clamp-2 min-h-[35px] text-pretty text-[12.5px] font-medium leading-[1.4] text-foreground"
        title={task.title}
      >
        {task.title}
      </span>

      {/* 3 — footer: priority left, then due, then the assignee last */}
      <span className="flex items-center gap-2">
        <PriorityIndicator priority={task.priority} size="board" />
        <span className="flex-1" />
        {task.dueLabel ? (
          <span className="text-[11px] tabular-nums text-muted-foreground/75">{task.dueLabel}</span>
        ) : null}
        <AssigneesAvatar users={task.assignedTo} size="xs" emptyDisplay="avatar" />
      </span>
    </button>
  );
});

// The same card without the drag wrapper. A read-only board — today, a past
// sprint's — is the same board component with `readOnly`, not a copy of it, so
// the cards, the columns and their order are guaranteed to be the ones the
// person is used to. Opening a ticket still works: reading history is the point.
const StaticBoardTaskCard = memo(function StaticBoardTaskCard({ task, onOpen }) {
  return (
    <div data-test={`board-task-${task.id}-static`}>
      <BoardTaskCardBody task={task} onOpen={onOpen} />
    </div>
  );
});

const DraggableBoardTaskCard = memo(function DraggableBoardTaskCard({ task, columnId, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task, columnId },
  });

  return (
    <div
      ref={setNodeRef}
      data-test={`board-task-${task.id}-drag`}
      className={cn('touch-none select-none', isDragging && 'opacity-40')}
      {...listeners}
      {...attributes}
    >
      <BoardTaskCardBody task={task} onOpen={onOpen} compact={isDragging} />
    </div>
  );
});

const BoardColumn = memo(function BoardColumn({
  col,
  fetchMode,
  workspaceId,
  search,
  queryFilters,
  enabled,
  onOpen,
  onNewTicketInColumn,
  boardHelpers,
  flush = false,
  isBoardDragging = false,
  sortKey = DEFAULT_BOARD_SORT,
  collapsed = false,
  onToggleCollapsed,
  readOnly = false,
}) {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  // A column's stripe is its only identifier, and the colour behind it is
  // workspace data rather than a token — so a colour vision mode has to remap it
  // here instead of in CSS. See `getColumnAccentStyles`.
  const { colorblind } = useThemeConfig();
  const style = getColumnStyle(boardHelpers, col.id, colorblind !== 'off');
  const columnStatusId = boardHelpers.resolveStatusFromColumnId(col.id);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isFetching, isError } =
    useBoardColumnTickets({
      columnStatusId: col.id,
      fetchMode,
      workspaceId,
      search,
      queryFilters,
      enabled,
    });

  const tasks = useMemo(() => {
    const pages = data?.pages || [];
    const merged = pages.flatMap((page) =>
      (page?.data || []).map((ticket) => buildBoardTaskView(ticket, boardHelpers))
    );
    const filtered = sortBoardTasksByPriorityOrder(merged, queryFilters.priorityOrder);
    // The priority filter's own asc/desc toggle stays authoritative when it is
    // set — it is an explicit filter choice, not a view preference.
    return queryFilters.priorityOrder ? filtered : sortBoardCards(filtered, sortKey);
  }, [data?.pages, boardHelpers, queryFilters.priorityOrder, sortKey]);

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  // `!data`, not `tasks.length === 0`: the test is whether this column has
  // anything to show yet, not whether it happens to be empty. An empty column is
  // a real answer, and `isFetching` is true for background refetches too — so
  // keying on the card count put a skeleton over every empty column each time
  // anything invalidated the board, which after an optimistic drag is
  // immediately. Dragging the last card out of a column flashed a skeleton in
  // place of the empty state it had just been given. Same reasoning as the
  // board-level latch below, one level down.
  const isColumnLoading = isLoading || (isFetching && !data);
  const totalCount = isColumnLoading ? null : (data?.pages?.[0]?.pagination?.total ?? tasks.length);

  // A read-only column is never a drop target. Registering it as one would be
  // harmless — there is nothing draggable on the board to drop — but it would
  // also mean the guard lived in one place and the affordance in another.
  const { setNodeRef, isOver } = useDroppable({
    id: col.id,
    disabled: readOnly,
  });

  useEffect(() => {
    if (isBoardDragging) return undefined;

    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasNextPage) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root, rootMargin: '120px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isBoardDragging,
    taskIds.length,
    search,
    queryFilters,
  ]);

  const countLabel = isColumnLoading ? 'Loading…' : `${totalCount ?? tasks.length} tasks`;

  // Collapsed: a 48px strip with the name running up it. Still a drop target, so
  // a column you have parked out of the way can take a card without reopening.
  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        data-test={`board-column-${col.id}-drop`}
        className={cn(
          'flex w-12 flex-[0_0_3rem] flex-col overflow-hidden rounded-[var(--r-card)] border border-border bg-card',
          flush ? 'h-full max-h-full min-h-0' : 'min-h-[16rem]',
          isOver && 'border-primary/40 bg-primary/5 ring-2 ring-primary/25'
        )}
        style={{ borderTopColor: style.borderTopColor, borderTopWidth: 2 }}
      >
        <button
          type="button"
          onClick={() => onToggleCollapsed?.(col.id)}
          aria-label={`Expand ${col.title} column`}
          aria-expanded={false}
          data-test={`board-column-${col.id}-expand-button`}
          className="flex h-full w-full flex-col items-center gap-2.5 py-3"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: style.borderTopColor }}
            aria-hidden
          />
          <span
            className="min-h-0 flex-1 text-[11.5px] font-semibold tracking-[0.02em] text-muted-foreground"
            style={{ writingMode: 'vertical-rl' }}
          >
            {col.title}
          </span>
          <span className="text-[11px] text-muted-foreground/75">
            {isColumnLoading ? '…' : (totalCount ?? tasks.length)}
          </span>
        </button>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      data-test={`board-column-${col.id}-drop`}
      className={cn(
        // 12px radius, one hairline outline and a 2px status edge on top — the
        // column carries the status colour so the cards don't have to.
        // The width band is `--board-col-min`/`--board-col-max` (index.css), not
        // literals: the floor is the flex basis, and the ceiling exists only to
        // stop `flex-grow` stretching a few columns past ~400px on a wide monitor.
        // The ceiling lifts under a collapsed rail, so the width the rail frees
        // goes into the columns instead of sitting as dead margin on the right.
        'flex min-w-0 max-w-[var(--board-col-max)] flex-[1_1_var(--board-col-min)] flex-col overflow-hidden rounded-[var(--r-card)] border border-border bg-card',
        flush
          ? 'h-full max-h-full min-h-0'
          : 'max-h-[min(calc(var(--app-vh)*0.96),calc(var(--app-vh)-14.375rem))]',
        isOver && 'border-primary/40 bg-primary/5 ring-2 ring-primary/25'
      )}
      style={{ borderTopColor: style.borderTopColor, borderTopWidth: 2 }}
    >
      <div className="flex shrink-0 items-center gap-1.5 border-b border-separator px-2.5 pb-2.5 pt-[11px]">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: style.borderTopColor }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">
          {col.title}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground/75">
          {isColumnLoading ? '…' : (totalCount ?? tasks.length)}
        </span>
        {columnStatusId && onNewTicketInColumn && !readOnly ? (
          <button
            type="button"
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[var(--r-badge)] text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`New ticket in ${col.title}`}
            onClick={() => onNewTicketInColumn(columnStatusId)}
            data-test={`board-column-${col.id}-new-button`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={() => onToggleCollapsed(col.id)}
            aria-label={`Collapse ${col.title} column`}
            aria-expanded
            data-test={`board-column-${col.id}-collapse-button`}
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[var(--r-badge)] text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <p className="sr-only">{countLabel}</p>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2.5"
        >
          {isError ? (
            <p className="rounded-[var(--r-tile)] border border-destructive/30 bg-destructive/5 py-5 text-center text-[11.5px] text-[hsl(var(--tone-danger-fg))]">
              Failed to load tickets.
            </p>
          ) : null}

          {isColumnLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-[var(--r-tile)] border border-separator p-2.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : null}

          {!isColumnLoading && !isError && tasks.length === 0 ? (
            <p className="rounded-[var(--r-tile)] border border-dashed border-border px-2.5 py-5 text-center text-[11.5px] text-muted-foreground/75">
              {/* "Drop tickets here" is an invitation, and a read-only board is
                  not inviting anything — it would be the one place on a frozen
                  board that suggested it could be changed. */}
              {readOnly ? 'No tickets' : 'Drop tickets here'}
            </p>
          ) : null}

          {!isColumnLoading && !isError
            ? tasks.map((task) =>
                readOnly ? (
                  <StaticBoardTaskCard key={task.id} task={task} onOpen={onOpen} />
                ) : (
                  <DraggableBoardTaskCard
                    key={task.id}
                    task={task}
                    columnId={col.id}
                    onOpen={onOpen}
                  />
                )
              )
            : null}

          {isFetchingNextPage ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
              <span className="sr-only">Loading more tickets</span>
            </div>
          ) : null}

          <div ref={sentinelRef} className="h-1 shrink-0" aria-hidden />
        </div>
      </div>
    </section>
  );
});

export default function BoardPage({
  fetchMode = 'all',
  workspaceId,
  search = '',
  queryFilters = {},
  enabled = true,
  statusesLoading = false,
  statusesError = false,
  onNewTicket,
  onOpenTicket,
  onStatusChange,
  boardHelpers,
  flush = false,
  sortKey = DEFAULT_BOARD_SORT,
  // A frozen board: no drag, no drop targets, no per-column `+`. The past-sprint
  // board is this component with `readOnly`, per the spec — the same board, not
  // a second one that has to be kept in step with it.
  readOnly = false,
}) {
  const [activeTaskView, setActiveTaskView] = useState(null);
  const [collapsedColumns, setCollapsedColumns] = useState(() => new Set());
  // Held for one full turn of the animation — same reasoning as the ticket list this sits next to.
  // Released on a failed statuses fetch: there is nothing arriving to hold the mark for.
  const showBoardLoader = useLoaderHold(statusesLoading, { release: statusesError });
  // Any column still fetching means the board is still arriving. Scoped to the board's own key so
  // an unrelated background refetch elsewhere in the app cannot raise the mark over the columns.
  const columnsFetching = useIsFetching({ queryKey: [BOARD_COLUMN_QUERY_KEY] });
  // First load only. `useIsFetching` alone would raise the veil over a board the person is reading
  // every time a socket event invalidated a column or a filter changed — the one thing a loading
  // state must never do. So it latches once the columns have settled, and re-arms only when the
  // board is genuinely a different board.
  //
  // The latch has to wait until it has actually *seen* the columns fetch. `columnsFetching` is the
  // count as of the last render, and on the render that first mounts the columns that count is
  // still 0 — the children start their queries in effects, which run before this one. Latching on
  // that zero marked the board settled before a single request had left, and the mark never
  // appeared at all. A board served entirely from cache never trips `hasFetched`, so it stays
  // unsettled and simply never raises the veil, which is the right answer for it too.
  const [columnsSettled, setColumnsSettled] = useState(false);
  const columnsHaveFetched = useRef(false);
  useEffect(() => {
    columnsHaveFetched.current = false;
    setColumnsSettled(false);
  }, [workspaceId, fetchMode]);
  useEffect(() => {
    if (columnsFetching > 0) {
      columnsHaveFetched.current = true;
      return;
    }
    if (columnsHaveFetched.current) setColumnsSettled(true);
  }, [columnsFetching]);
  const showColumnsLoader = useLoaderHold(!columnsSettled && columnsFetching > 0);

  const toggleColumnCollapsed = useCallback((columnId) => {
    setCollapsedColumns((current) => {
      const next = new Set(current);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const columns = boardHelpers?.boardColumns || [];
  const isBoardDragging = activeTaskView != null;

  const handleDragStart = useCallback((event) => {
    const payload = event.active.data.current;
    if (payload?.task) setActiveTaskView(payload.task);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveTaskView(null);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveTaskView(null);

      // Nothing on a read-only board is draggable, so this cannot fire — the
      // guard is here so that a future draggable added upstream cannot quietly
      // start writing status changes to a frozen board.
      if (readOnly || !over || !boardHelpers) return;

      const sourceColumnId = active.data.current?.columnId;
      const destinationColumnId = boardHelpers.boardColumns.some((column) => column.id === over.id)
        ? over.id
        : (over.data.current?.columnId ?? null);

      if (destinationColumnId && destinationColumnId !== sourceColumnId) {
        onStatusChange?.(active.id, destinationColumnId);
      }
    },
    [boardHelpers, onStatusChange, readOnly]
  );

  if (showBoardLoader || !boardHelpers?.hasStatuses) {
    return (
      <div
        className={cn(
          'w-full',
          flush ? 'flex h-full min-h-0 flex-1 flex-col' : 'flex min-h-0 flex-1 flex-col'
        )}
      >
        <LoadingOverlay label="Loading board">
          <BoardSkeleton />
        </LoadingOverlay>
      </div>
    );
  }

  // `flex-wrap` is the whole point of the reflow: with every column at
  // `flex: 1 1 var(--board-col-min)` (210px), a narrow window drops the last
  // column onto a second row instead of pushing the board into a horizontal
  // scroll. Nothing here ever overflows sideways.
  const columnRow = (
    <div className={cn('relative flex flex-wrap items-stretch gap-3 pb-5', flush && 'min-h-0')}>
      {columns.map((col) => (
        <BoardColumn
          key={col.id}
          col={col}
          fetchMode={fetchMode}
          workspaceId={workspaceId}
          search={search}
          queryFilters={queryFilters}
          enabled={enabled}
          onOpen={onOpenTicket}
          onNewTicketInColumn={onNewTicket}
          boardHelpers={boardHelpers}
          flush={flush}
          isBoardDragging={isBoardDragging}
          sortKey={sortKey}
          collapsed={collapsedColumns.has(col.id)}
          onToggleCollapsed={toggleColumnCollapsed}
          readOnly={readOnly}
        />
      ))}
      {/* One mark for the whole board, not one per column. Every column fetches on its own, so
          the columns keep their card skeletons — that is the shape — but four marks unfurling
          side by side would read as four separate waits instead of one board arriving. Held on
          the same 1.5s floor as everything else. */}
      {showColumnsLoader && <Loader variant="overlay" label="Loading board" />}
    </div>
  );

  return (
    <div
      // Anchor for the what's-new tour, which opens `/tickets?view=board` and
      // spotlights the board. See `whatsNewSteps.js`.
      data-tour="tickets-board"
      className={cn(
        'w-full',
        flush ? 'flex h-full min-h-0 flex-1 flex-col' : 'flex min-h-0 flex-1 flex-col'
      )}
    >
      {/* No outer card: in the mockup the columns sit straight on the page, and a
          panel around them would be a second frame inside the page header's. */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          flush ? 'h-full' : 'min-h-[calc(var(--app-vh)-9rem)]'
        )}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          {/* Vertical only — the board never scrolls sideways at any width. */}
          {flush ? (
            <div className="h-full min-h-0 w-full flex-1 overflow-y-auto">{columnRow}</div>
          ) : (
            <ScrollArea className="h-[calc(var(--app-vh)-9rem)] min-h-0 w-full flex-1">
              {columnRow}
            </ScrollArea>
          )}

          <DragOverlay dropAnimation={null}>
            {activeTaskView ? (
              <div className="pointer-events-none w-[288px] cursor-grabbing touch-none will-change-transform">
                <BoardTaskCardBody
                  task={activeTaskView}
                  onOpen={() => {}}
                  cardClassName="ring-2 ring-primary/20"
                  compact
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
