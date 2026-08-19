import { useState } from 'react';
import { GitPullRequest } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CHIP, chipTone } from '@/helpers/badgeTones';
import {
  reviewChipLabel,
  reviewChipTone,
  reviewPullRequestMismatch,
  validatePullRequestUrl,
} from '@/helpers/reviewRequest';
import {
  useAnswerReview,
  useCancelReview,
  useRequestReview,
  useReviewerCandidates,
} from '@/queries/tickets';
import { resolveUserId } from '@/helpers/userIdentity';
import { cn } from '@/lib/utils';

const EMPTY_CAUSE_COPY = {
  no_profile: 'You have no intern profile, so no mentor can be resolved.',
  no_mentor: 'You have no mentor set. Ask an admin to assign one.',
  not_workspace_members: 'None of your mentors are members of this workspace.',
};

const RailCaption = ({ children }) => (
  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.07em] text-muted-foreground/75">
    <GitPullRequest className="h-3 w-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
    {children}
  </span>
);

/**
 * The ticket meta rail's review section — an intern asking one of their own
 * mentors to look at a pull request, and that mentor's answer.
 *
 * Renders for everyone once a request exists (it is workspace-visible), but
 * the request/re-request form only for the requesting intern, and the
 * approve/changes-requested controls only for the named reviewer — matching
 * `server/helpers/reviewRequestRules.js`'s transition guards. Section is
 * entirely absent for a non-assignee with no live request: there is nothing
 * for them to see or do.
 */
export function TicketReviewField({ ticket, ticketId, currentUser, disabled = false }) {
  const [formOpen, setFormOpen] = useState(false);

  const reviewRequest = ticket?.reviewRequest;
  const currentUserId = resolveUserId(currentUser);
  const isIntern = currentUser?.role === 'intern';
  const isAssignee = (ticket?.assignedTo || []).some(
    (assignee) => String(resolveUserId(assignee)) === String(currentUserId)
  );
  const canRequest = isIntern && isAssignee && !disabled;

  const reviewerId = resolveUserId(reviewRequest?.reviewer);
  const requestedById = resolveUserId(reviewRequest?.requestedBy);
  const isReviewer = String(reviewerId) === String(currentUserId);
  const isRequester = String(requestedById) === String(currentUserId);

  const requestReviewMutation = useRequestReview();
  const answerReviewMutation = useAnswerReview();
  const cancelReviewMutation = useCancelReview();

  const { data: candidatesResponse } = useReviewerCandidates(ticketId, {
    enabled: canRequest,
  });
  const candidates = candidatesResponse?.data?.candidates || [];
  const emptyCause = candidatesResponse?.data?.emptyCause;

  if (!reviewRequest && !canRequest) return null;

  const showForm = canRequest && (formOpen || !reviewRequest);

  return (
    <section className="flex flex-col gap-2.5 border-b border-separator pb-3.5">
      <RailCaption>REVIEW</RailCaption>

      {reviewRequest ? (
        <ReviewSummary
          reviewRequest={reviewRequest}
          isReviewer={isReviewer}
          isRequester={isRequester}
          onAnswer={(decision) => answerReviewMutation.mutate({ ticketId, decision })}
          onCancel={() => cancelReviewMutation.mutate(ticketId)}
          answerPending={answerReviewMutation.isPending}
          cancelPending={cancelReviewMutation.isPending}
          onReRequest={canRequest ? () => setFormOpen(true) : null}
        />
      ) : null}

      {showForm ? (
        <RequestReviewForm
          ticketId={ticketId}
          candidates={candidates}
          emptyCause={emptyCause}
          linkedPullRequest={ticket?.linkedPullRequest}
          mutation={requestReviewMutation}
          onDone={() => setFormOpen(false)}
        />
      ) : null}
    </section>
  );
}

function ReviewSummary({
  reviewRequest,
  isReviewer,
  isRequester,
  onAnswer,
  onCancel,
  answerPending,
  cancelPending,
  onReRequest,
}) {
  const reviewer = reviewRequest.reviewer;
  const label = reviewChipLabel(reviewRequest);
  const tone = reviewChipTone(reviewRequest);
  const requestedAgo = reviewRequest.requestedAt
    ? formatDistanceToNow(new Date(reviewRequest.requestedAt), { addSuffix: true })
    : null;

  return (
    <div
      className="flex flex-col gap-2 rounded-[var(--r-tile)] border border-separator bg-card px-2.5 py-2"
      data-test="ticket-review-summary"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn(CHIP, chipTone(tone))}>{label}</span>
        {reviewRequest.state === 'pending' && requestedAgo ? (
          <span className="text-[10.5px] text-muted-foreground/75">{requestedAgo}</span>
        ) : null}
      </div>

      {reviewer ? (
        <div className="flex items-center gap-2">
          {typeof reviewer === 'object' ? <Avatar users={[reviewer]} size="xs" /> : null}
          <span className="min-w-0 truncate text-[12.5px] text-foreground">
            {reviewer?.fullname || 'Reviewer'}
          </span>
        </div>
      ) : null}

      {reviewRequest.prUrl ? (
        <a
          href={reviewRequest.prUrl}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[12.5px] text-[hsl(var(--tone-info-fg))] underline-offset-2 hover:underline"
        >
          {reviewRequest.prUrl}
        </a>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {isReviewer && reviewRequest.state === 'pending' ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={answerPending}
              onClick={() => onAnswer('approved')}
              data-test="ticket-review-approve-button"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={answerPending}
              onClick={() => onAnswer('changes_requested')}
              data-test="ticket-review-changes-button"
            >
              Request changes
            </Button>
          </>
        ) : null}

        {isRequester && reviewRequest.state !== 'pending' && onReRequest ? (
          <Button size="sm" variant="secondary" onClick={onReRequest}>
            Request again
          </Button>
        ) : null}

        {isReviewer || isRequester ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={cancelPending}
            onClick={onCancel}
            data-test="ticket-review-cancel-button"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RequestReviewForm({
  ticketId,
  candidates,
  emptyCause,
  linkedPullRequest,
  mutation,
  onDone,
}) {
  const [reviewerId, setReviewerId] = useState('');
  const [prUrl, setPrUrl] = useState(linkedPullRequest?.url || '');
  const [touched, setTouched] = useState(false);

  const clientError = touched ? validatePullRequestUrl(prUrl) : null;
  const mismatch = reviewPullRequestMismatch({
    prUrl,
    linkedPrNumber: linkedPullRequest?.prNumber,
  });

  if (candidates.length === 0) {
    return (
      <p className="text-[12.5px] text-muted-foreground" data-test="ticket-review-empty-cause">
        {EMPTY_CAUSE_COPY[emptyCause] || 'No mentor is available to review this ticket.'}
      </p>
    );
  }

  const submit = () => {
    setTouched(true);
    const error = validatePullRequestUrl(prUrl);
    if (error || !reviewerId) return;

    mutation.mutate({ ticketId, prUrl: prUrl.trim(), reviewerId }, { onSuccess: onDone });
  };

  return (
    <div className="flex flex-col gap-2" data-test="ticket-review-request-form">
      <Select value={reviewerId} onValueChange={setReviewerId}>
        <SelectTrigger data-test="ticket-review-reviewer-trigger">
          <SelectValue placeholder="Choose a mentor" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((candidate) => (
            <SelectItem key={candidate._id} value={candidate._id}>
              {candidate.fullname}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={prUrl}
        onChange={(e) => setPrUrl(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="https://github.com/<owner>/<repo>/pull/<number>"
        className="bg-card text-[12.5px]"
        data-test="ticket-review-pr-url-input"
      />
      {clientError ? (
        <p className="text-[11px] text-[hsl(var(--tone-danger-fg))]">{clientError}</p>
      ) : mismatch ? (
        <p className="text-[11px] text-[hsl(var(--tone-warning-fg))]">
          This doesn&apos;t match the linked pull request — you can still send it.
        </p>
      ) : null}

      <Button
        size="sm"
        onClick={submit}
        disabled={mutation.isPending || !reviewerId}
        data-test="ticket-review-submit-button"
      >
        Request review
      </Button>
    </div>
  );
}

export default TicketReviewField;
