import { Repeat } from 'lucide-react';

import { CHIP, chipTone } from '@/helpers/badgeTones';
import { cn } from '@/lib/utils';

/**
 * The sprint a ticket is committed to, next to its subject in a list or on a
 * board card. Read-only (ticket 11) — every sprint write happens on the
 * Sprints screen, so this is the name and nothing else.
 *
 * Geometry and colour come from the shared chip vocabulary, same as
 * `BlockedByChip` and `TicketReviewChip`, so it matches its neighbours in the
 * subject row. A ticket in no sprint renders nothing.
 */
export function SprintChip({ sprint, className }) {
  const name = sprint?.name;
  if (!name) return null;

  return (
    <span
      className={cn(CHIP, 'max-w-[140px] gap-1', chipTone('violet'), className)}
      title={`In sprint ${name}`}
      data-test="ticket-sprint-chip"
    >
      <Repeat className="h-3 w-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

export default SprintChip;
