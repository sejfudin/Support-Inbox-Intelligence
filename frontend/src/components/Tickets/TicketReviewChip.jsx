import { GitPullRequest } from 'lucide-react';

import { CHIP, chipTone } from '@/helpers/badgeTones';
import { reviewChipLabel, reviewChipTone } from '@/helpers/reviewRequest';
import { cn } from '@/lib/utils';

/**
 * "Review pending" / "Review approved" / "Changes requested" next to a ticket
 * in a list or on a board card — the at-a-glance version of the review
 * section in the ticket details. Geometry and colour come from the shared
 * chip vocabulary, same as `BlockedByChip`, so it matches its neighbours in
 * the card's meta row.
 *
 * Renders nothing without a live request — see `reviewChipLabel`.
 */
export function TicketReviewChip({ reviewRequest, className }) {
  const label = reviewChipLabel(reviewRequest);
  if (!label) return null;

  return (
    <span
      className={cn(CHIP, 'max-w-full gap-1', chipTone(reviewChipTone(reviewRequest)), className)}
      title={reviewRequest?.reviewer?.fullname ? `Asked ${reviewRequest.reviewer.fullname}` : label}
      data-test="ticket-review-chip"
    >
      <GitPullRequest className="h-3 w-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export default TicketReviewChip;
