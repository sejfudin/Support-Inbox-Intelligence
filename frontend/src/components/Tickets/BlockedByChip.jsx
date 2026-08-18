import { CircleSlash } from 'lucide-react';

import { CHIP, chipTone } from '@/helpers/badgeTones';
import { blockedByChipLabel, blockerTicketId } from '@/helpers/ticketBlocker';
import { cn } from '@/lib/utils';

/**
 * "Blocked by #12" next to a ticket in a list or on a board card — the
 * at-a-glance version of the blocker section in the ticket details.
 *
 * Geometry and colour both come from the shared chip vocabulary (`CHIP` +
 * `chipTone('danger')`), so it sits at exactly the size of the category and PR
 * chips beside it, and it follows the colour-blind-safe palette instead of
 * hard-coding red.
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

  const tone = cn(CHIP, 'max-w-full gap-1', chipTone('danger'), className);

  const body = (
    <>
      <CircleSlash className="h-3 w-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </>
  );

  if (!onOpenTicket || !blockingId) {
    return (
      <span className={tone} title={blocker?.subject || undefined}>
        {body}
      </span>
    );
  }

  const open = (e) => {
    // The row and the board card are both click targets that open THIS ticket.
    // Letting the event through would open the wrong one.
    e.stopPropagation();
    e.preventDefault();
    onOpenTicket(blockingId);
  };

  // A span with a button role rather than a real `<button>`: the redesigned board
  // card is itself a `<button>`, and a nested one is invalid DOM. Keyboard
  // activation is wired by hand to match what the element type would have given.
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === ' ') open(e);
      }}
      // The board card is a dnd-kit draggable, and its drag listeners sit on an
      // ancestor. Its 8px activation distance already lets a plain click through,
      // but keeping pointerdown off the drag handle means the chip stays a button
      // even if that constraint is ever relaxed.
      onPointerDown={(e) => e.stopPropagation()}
      title={
        blocker?.subject ? `${label} — ${blocker.subject}. Open it.` : `${label}. Open that ticket.`
      }
      data-test={`ticket-blocked-by-chip-${blockingId}`}
      className={cn(tone, 'ui-focus-ring cursor-pointer transition-opacity hover:underline')}
    >
      {body}
    </span>
  );
}

export default BlockedByChip;
