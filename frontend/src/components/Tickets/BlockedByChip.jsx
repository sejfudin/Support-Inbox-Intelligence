import { CircleSlash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { blockedByChipLabel, blockerTicketId } from '@/helpers/ticketBlocker';

/**
 * "Blocked by #12" next to a ticket in a list or on a board card — the at-a-glance
 * version of the blocker panel in the ticket details.
 *
 * Clicking it opens the BLOCKING ticket, not the row it sits on, so it stops the
 * click from reaching the row/card handler underneath. Without `onOpenTicket` it
 * renders as plain text rather than a dead button.
 *
 * Renders nothing unless the blocker has a task number — see `blockedByChipLabel`.
 */
export function BlockedByChip({ blocker, onOpenTicket, className }) {
  const label = blockedByChipLabel(blocker);
  const blockingId = blockerTicketId(blocker);

  if (!label) return null;

  const tone =
    'inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-300';

  const body = (
    <>
      <CircleSlash className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </>
  );

  if (!onOpenTicket || !blockingId) {
    return (
      <span className={cn(tone, className)} title={blocker?.subject || undefined}>
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        // The row and the board card are both click targets that open THIS
        // ticket. Letting the event through would open the wrong one.
        e.stopPropagation();
        e.preventDefault();
        onOpenTicket(blockingId);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      // The board card is a dnd-kit draggable, and its drag listeners sit on an
      // ancestor. Its 8px activation distance already lets a plain click through,
      // but keeping pointerdown off the drag handle means the chip stays a button
      // even if that constraint is ever relaxed.
      onPointerDown={(e) => e.stopPropagation()}
      title={
        blocker?.subject ? `${label} — ${blocker.subject}. Open it.` : `${label}. Open that ticket.`
      }
      data-test={`ticket-blocked-by-chip-${blockingId}`}
      className={cn(
        tone,
        'cursor-pointer transition-colors outline-none hover:bg-red-500/20 hover:underline focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-red-500/25',
        className
      )}
    >
      {body}
    </button>
  );
}

export default BlockedByChip;
