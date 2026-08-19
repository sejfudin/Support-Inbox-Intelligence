import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, GitPullRequest } from 'lucide-react';

import { Avatar } from '@/components/Avatar';
import { useTickets } from '@/queries/tickets';
import { reviewOverflowCaption } from '@/helpers/reviewRequest';

const ROW_LIMIT = 3;

/**
 * "Reviews I owe" — the admin dashboard's right rail card for review
 * requests addressed to the signed-in admin, current workspace, pending
 * only. Same data the tickets list's "waiting on my review" filter reads
 * (`GET /api/tickets?awaitingReviewFrom=me`), so the two can never disagree.
 *
 * Stays visible and says so when nothing is waiting, matching how
 * `TodayStandupCard` shows `0 / 4` rather than vanishing — a card that
 * disappears when empty makes the page layout jump between loads.
 */
export function ReviewsOwedCard({ workspaceId }) {
  const { data, isPending } = useTickets(
    {
      awaitingReviewFrom: 'me',
      workspaceId,
      limit: ROW_LIMIT,
      archived: false,
    },
    { enabled: !!workspaceId }
  );

  const tickets = data?.data || [];
  const total = data?.pagination?.total ?? 0;

  return (
    <section
      className="app-panel-soft flex min-h-0 flex-1 flex-col p-4 sm:p-5"
      aria-label="Reviews I owe"
      data-test="admin-dashboard-reviews-card"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold leading-6 text-foreground">Reviews I owe</h2>
        {!isPending ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {reviewOverflowCaption({ shown: tickets.length, total })}
          </span>
        ) : null}
      </header>

      <div className="mt-3 flex flex-col gap-2">
        {isPending ? (
          <div className="h-12 animate-pulse rounded-[var(--r-tile)] bg-muted" />
        ) : tickets.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">Nothing waiting on your review.</p>
        ) : (
          tickets.map((ticket) => <ReviewRow key={ticket._id} ticket={ticket} />)
        )}
      </div>

      <div className="mt-auto pt-4">
        <Link
          to="/tickets?awaitingReviewFrom=me"
          className="text-[12.5px] font-medium text-primary hover:underline"
          data-test="admin-dashboard-reviews-view-all"
        >
          View all
        </Link>
      </div>
    </section>
  );
}

function ReviewRow({ ticket }) {
  const intern = ticket.reviewRequest?.requestedBy;
  const prUrl = ticket.reviewRequest?.prUrl;
  const requestedAgo = ticket.reviewRequest?.requestedAt
    ? formatDistanceToNow(new Date(ticket.reviewRequest.requestedAt), { addSuffix: true })
    : null;

  return (
    <Link
      to={`/tickets?ticket=${ticket._id}&focus=${Date.now()}`}
      className="flex items-center gap-2 rounded-[var(--r-tile)] border border-separator bg-card px-2.5 py-2 transition-colors hover:bg-accent/50"
      data-test={`admin-dashboard-review-row-${ticket._id}`}
    >
      {intern && typeof intern === 'object' ? <Avatar users={[intern]} size="xs" /> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-foreground">
          {ticket.taskNumber ? `#${ticket.taskNumber} ` : ''}
          {ticket.subject}
        </p>
        <p className="truncate text-[10.5px] text-muted-foreground/75">
          {intern?.fullname || 'Unknown intern'}
          {requestedAgo ? ` · ${requestedAgo}` : ''}
        </p>
      </div>
      {prUrl ? (
        <a
          href={prUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-muted-foreground/75 hover:text-foreground"
          aria-label="Open pull request"
          title="Open pull request"
        >
          <span className="relative inline-flex">
            <GitPullRequest className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
            <ExternalLink className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5" aria-hidden="true" />
          </span>
        </a>
      ) : null}
    </Link>
  );
}

export default ReviewsOwedCard;
