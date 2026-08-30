import { memo, useState } from 'react';
import { format } from 'date-fns';
import { GripVertical, X } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import PriorityIndicator from '@/components/PriorityIndicator';
import AssigneesAvatar from '@/components/Tickets/AssigneesAvatar';
import StoryPointsField from '@/components/StoryPointsField';
import { useUpdateTicket } from '@/queries/tickets';
import { normalizeTicket } from '@/helpers/normalizeTicket';
import { htmlToPlainText } from '@/helpers/aiDescriptionPrompt';
import { cn } from '@/lib/utils';

// Same tint scheme as the board card (`BoardPage.jsx`'s `CATEGORY_TONE`) — kept
// local here rather than shared, since the two cards otherwise have nothing else
// in common (this one adds a remove button and an unestimated state, the board
// one adds PR/review chips).
const CATEGORY_TONE = {
  bug: 'bg-[hsl(var(--tone-danger)/0.15)] text-[hsl(var(--tone-danger-fg))]',
  feature: 'bg-[hsl(var(--tone-info)/0.15)] text-[hsl(var(--tone-info-fg))]',
  refactor: 'bg-primary/10 text-primary',
  fix: 'bg-[hsl(var(--tone-warning)/0.15)] text-[hsl(var(--tone-warning-fg))]',
};

const categoryTone = (label) =>
  CATEGORY_TONE[
    String(label || '')
      .trim()
      .toLowerCase()
  ] || 'bg-muted text-muted-foreground';

const formatDueLabel = (dueDate) => {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'MMM d');
};

/** Raw ticket (from `GET /tickets`) → the view shape this card and the picker's split logic need. */
export const buildPlanningTicketView = (ticket) => {
  const normalized = normalizeTicket(ticket);
  const category = ticket.category;
  const categoryLabel =
    category && typeof category === 'object' ? String(category.name || '').trim() : '';

  return {
    id: normalized.id,
    title: normalized.title,
    description: htmlToPlainText(normalized.description),
    priority: normalized.priority,
    dueLabel: formatDueLabel(normalized.dueDate),
    assignedTo: normalized.assignedTo,
    taskNumber: normalized.taskNumber,
    storyPoints: normalized.storyPoints,
    categoryLabel,
    isBacklog: Boolean(normalized.statusMeta?.isBacklog),
  };
};

/**
 * The picker's ticket card — same anatomy in both panes. Draggable unless it has
 * no story-point estimate, in which case it offers an inline estimate control
 * instead of accepting a drag. `onRemove` renders the `X` and is only passed for
 * cards already in the sprint (which always carry an estimate, so `workspaceId`
 * is only needed by unestimated cards in the source pane).
 */
export const SprintPlanningTicketCard = memo(function SprintPlanningTicketCard({
  ticket,
  onRemove,
  dragDisabled = false,
  workspaceId,
}) {
  const needsEstimate = ticket.storyPoints == null;
  const canDrag = !dragDisabled && !needsEstimate;
  const hasAssignee = Array.isArray(ticket.assignedTo)
    ? ticket.assignedTo.length > 0
    : Boolean(ticket.assignedTo);

  const updateTicketMutation = useUpdateTicket();
  const [estimateFailed, setEstimateFailed] = useState(false);

  const handleSetEstimate = (value) => {
    setEstimateFailed(false);
    updateTicketMutation.mutate(
      { ticketId: ticket.id, updates: { storyPoints: value }, workspaceId },
      { onError: () => setEstimateFailed(true) }
    );
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      data-test={`sprint-picker-card-${ticket.id}`}
      className={cn(
        'flex flex-col gap-1.5 rounded-[var(--r-tile)] border bg-card p-2.5',
        canDrag
          ? 'touch-none select-none cursor-grab border-separator active:cursor-grabbing'
          : 'select-none border-dashed border-separator bg-muted/30',
        isDragging && 'opacity-40'
      )}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {ticket.taskNumber != null && (
          <span className="flex-none text-[10.5px] font-semibold tabular-nums text-muted-foreground/75">
            #{ticket.taskNumber}
          </span>
        )}
        {needsEstimate ? (
          <StoryPointsField
            value={null}
            onChange={handleSetEstimate}
            disabled={updateTicketMutation.isPending}
            hideLabel
            className="w-28 flex-none space-y-0 [&_button]:gap-1 [&_button]:px-2 [&_button]:py-1 [&_button]:text-[10.5px] [&_svg]:h-3 [&_svg]:w-3"
          />
        ) : (
          <span className="flex-none rounded-[5px] bg-muted px-1.5 py-px text-[10.5px] font-semibold text-muted-foreground">
            {ticket.storyPoints} pts
          </span>
        )}
        <span className="min-w-0 flex-1" />
        {ticket.categoryLabel ? (
          <span
            className={cn(
              'flex-none rounded-[5px] px-1.5 py-px text-[10px] font-semibold',
              categoryTone(ticket.categoryLabel)
            )}
          >
            {ticket.categoryLabel}
          </span>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(ticket.id)}
            aria-label={`Remove ticket #${ticket.taskNumber} from the sprint`}
            data-test={`sprint-picker-remove-${ticket.id}`}
            className="flex-none rounded-[var(--r-badge)] p-0.5 text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        ) : canDrag ? (
          <GripVertical
            className="h-3.5 w-3.5 flex-none text-muted-foreground/40"
            aria-hidden="true"
          />
        ) : null}
      </span>

      <span
        className="line-clamp-2 text-[12.5px] font-semibold leading-[1.4] text-foreground"
        title={ticket.title}
      >
        {ticket.title}
      </span>

      {ticket.description ? (
        <span
          className="line-clamp-3 text-[11.5px] leading-[1.4] text-muted-foreground"
          title={ticket.description}
        >
          {ticket.description}
        </span>
      ) : null}

      <span className="flex items-center gap-2">
        <PriorityIndicator priority={ticket.priority} size="board" />
        <span className="flex-1" />
        {ticket.dueLabel ? (
          <span className="text-[11px] tabular-nums text-muted-foreground/75">
            {ticket.dueLabel}
          </span>
        ) : null}
        {hasAssignee ? (
          <AssigneesAvatar users={ticket.assignedTo} size="xs" emptyDisplay="avatar" />
        ) : null}
      </span>

      {estimateFailed ? (
        <span className="text-[11px] text-[hsl(var(--tone-danger-fg))]">
          Could not save the estimate. Try again.
        </span>
      ) : needsEstimate ? (
        <span className="text-[11px] text-[hsl(var(--tone-warning-fg))]">
          Needs a story-point estimate to join a sprint.
        </span>
      ) : null}
    </div>
  );
});
