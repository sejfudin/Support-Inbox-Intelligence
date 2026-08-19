/**
 * Pure rules for a ticket's review request — an intern asking one of their own
 * mentors to look at a pull request, and that mentor answering approved or
 * changes requested. No I/O, no clock read: timestamps are always passed in.
 *
 * At most one request per ticket, cleared rather than accumulated — same shape
 * choice `blockedBy` made (`helpers/ticketBlocker.js`). Requesting again from
 * any prior state replaces it and resets to `pending`; there is no separate
 * re-request path.
 *
 * The reviewer candidate list is never a free choice of person — see
 * ADR 0007. The typed pull-request URL is stored and compared, never
 * reconciled with `Ticket.linkedPullRequest` — see ADR 0008.
 */
const { httpError } = require('./httpError');
const { isActiveWorkspaceMember } = require('./workspaceAuthz');

const REVIEW_REQUEST_STATES = ['pending', 'approved', 'changes_requested'];

const PR_URL_MAX_LENGTH = 500;
const PR_URL_ERROR =
  'Pull request URL must look like https://github.com/<owner>/<repo>/pull/<number>';
const PR_URL_PATTERN = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)$/;

const NOT_INTERN_ERROR = 'Only an intern may request a review';
const NOT_ASSIGNEE_ERROR = 'Only an assignee of this ticket may request a review';
const NOT_REVIEWER_ERROR = 'Only the requested reviewer may answer this review';
const NOT_PARTY_ERROR = 'Only the requesting intern or the reviewer may cancel this review';
const INVALID_STATE_ERROR = 'A review can only be answered approved or changes requested';
const NOT_PENDING_ERROR = 'This review request has already been answered';
const NOT_MENTOR_ERROR = 'The reviewer must be one of your own mentors';
const REVIEWER_NOT_MEMBER_ERROR = 'The reviewer is not an active member of this workspace';
const MISSING_PR_URL_ERROR = 'A pull request URL is required to request a review';

const CANDIDATE_EMPTY_CAUSES = Object.freeze({
  NO_PROFILE: 'no_profile',
  NO_MENTOR: 'no_mentor',
  NOT_WORKSPACE_MEMBERS: 'not_workspace_members',
});

const MISMATCH = Object.freeze({
  AGREES: 'agrees',
  DISAGREES: 'disagrees',
  NO_COMPARISON: 'no_comparison',
});

/**
 * Accepts only `https://github.com/<owner>/<repo>/pull/<n>` and returns the
 * three parsed parts. These are the only way `owner`/`repo`/`prNumber` are
 * produced — nothing else may supply them, so a caller cannot hand-craft a
 * mismatch between the stored URL and its derived parts.
 */
const parsePullRequestUrl = (rawUrl) => {
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!url) {
    throw httpError(MISSING_PR_URL_ERROR, 400);
  }
  if (url.length > PR_URL_MAX_LENGTH) {
    throw httpError(PR_URL_ERROR, 400);
  }
  const match = PR_URL_PATTERN.exec(url);
  if (!match) {
    throw httpError(PR_URL_ERROR, 400);
  }
  const [, owner, repo, prNumberRaw] = match;
  return { owner, repo, prNumber: Number(prNumberRaw) };
};

/**
 * The requester's mentors, unfiltered by workspace membership — the raw set
 * `resolveReviewerCandidates` filters, and the set `assertReviewerEligible`
 * checks a chosen reviewer against. Kept in one place so the two never define
 * "one of my mentors" differently: `primaryMentor` always, `secondaryMentor`
 * only once `specializationAssignedAt` is set — a `secondaryMentor` without it
 * is legacy junk left by the specialization flow (ADR 0002), not a real
 * reviewer option.
 */
const mentorsForProfile = (internProfile) => {
  if (!internProfile) return [];
  const mentors = [];
  if (internProfile.primaryMentor) mentors.push(internProfile.primaryMentor);
  if (internProfile.secondaryMentor && internProfile.specializationAssignedAt) {
    mentors.push(internProfile.secondaryMentor);
  }
  return mentors;
};

/**
 * `mentorsForProfile`'s result filtered to active members of the ticket's
 * workspace, reusing the same predicate every other workspace-scoped read
 * uses. An empty result is first-class: `emptyCause` tells the UI whether
 * there is no profile at all, no mentor set on it, or mentors exist but none
 * belongs to this workspace.
 */
const resolveReviewerCandidates = ({ internProfile, workspace }) => {
  if (!internProfile) {
    return { candidates: [], emptyCause: CANDIDATE_EMPTY_CAUSES.NO_PROFILE };
  }

  const mentors = mentorsForProfile(internProfile);
  if (mentors.length === 0) {
    return { candidates: [], emptyCause: CANDIDATE_EMPTY_CAUSES.NO_MENTOR };
  }

  const candidates = mentors.filter((mentorId) => isActiveWorkspaceMember(workspace, mentorId));
  if (candidates.length === 0) {
    return { candidates: [], emptyCause: CANDIDATE_EMPTY_CAUSES.NOT_WORKSPACE_MEMBERS };
  }

  return { candidates, emptyCause: null };
};

/**
 * Guards the reviewer named on an incoming request, with the two failure
 * causes the route must report distinctly: picking someone who is not one of
 * the requester's own mentors, versus picking a real mentor who is not an
 * active member of the ticket's workspace.
 */
const assertReviewerEligible = ({ reviewerId, internProfile, workspace }) => {
  const mentors = mentorsForProfile(internProfile);
  const isMentor = mentors.some((mentorId) => String(mentorId) === String(reviewerId));
  if (!isMentor) throw httpError(NOT_MENTOR_ERROR, 403);
  if (!isActiveWorkspaceMember(workspace, reviewerId)) {
    throw httpError(REVIEWER_NOT_MEMBER_ERROR, 403);
  }
};

/** Requesting requires an intern profile and assignee membership on the ticket. */
const assertCanRequestReview = ({ isIntern, isAssignee }) => {
  if (!isIntern) throw httpError(NOT_INTERN_ERROR, 403);
  if (!isAssignee) throw httpError(NOT_ASSIGNEE_ERROR, 403);
};

/** Answering is the named reviewer only. */
const assertCanAnswerReview = ({ reviewerId, actorId }) => {
  if (!reviewerId || !actorId || String(reviewerId) !== String(actorId)) {
    throw httpError(NOT_REVIEWER_ERROR, 403);
  }
};

/**
 * Cancelling is the requesting intern or the named reviewer — nobody else — and
 * only while the request is still pending. An answered request is a record of
 * who reviewed and when, so neither party may erase it: the way off a verdict is
 * requesting again, which replaces the request rather than deleting the trace.
 */
const assertCanCancelReview = ({ requestedById, reviewerId, actorId, state }) => {
  const actor = String(actorId ?? '');
  if (actor !== String(requestedById ?? '') && actor !== String(reviewerId ?? '')) {
    throw httpError(NOT_PARTY_ERROR, 403);
  }
  if (state !== 'pending') {
    throw httpError(NOT_PENDING_ERROR, 409);
  }
};

/**
 * The full sub-document to persist for a new (or replacement) request.
 * Replacing an existing request — from any prior state — goes through this
 * same builder, which is what makes "replace" the only path: there is no
 * separate re-request function to drift from it.
 */
const buildReviewRequest = ({ prUrl, reviewer, requestedBy, requestedAt }) => {
  const { owner, repo, prNumber } = parsePullRequestUrl(prUrl);
  return {
    reviewer,
    state: 'pending',
    prUrl,
    owner,
    repo,
    prNumber,
    requestedBy,
    requestedAt,
    answeredAt: null,
  };
};

/** The reviewer's verdict. Refuses any state but the two legal answers, and any request not pending. */
const answerReviewRequest = ({ reviewRequest, state, answeredAt }) => {
  if (state !== 'approved' && state !== 'changes_requested') {
    throw httpError(INVALID_STATE_ERROR, 400);
  }
  if (reviewRequest?.state !== 'pending') {
    throw httpError(NOT_PENDING_ERROR, 409);
  }
  return { ...reviewRequest, state, answeredAt };
};

/**
 * A request goes stale — is dropped — only off the `isDone` behaviour flag or
 * the archived flag, never a status label (a workspace may have renamed it).
 * Nothing else auto-clears a request: not a merged pull request, not a
 * change to the intern's mentors.
 */
const isReviewRequestStale = ({ reviewRequest, isDone, isArchived }) =>
  Boolean(reviewRequest) && Boolean(isDone || isArchived);

/**
 * Compares the parsed PR number against the ticket's linked pull request.
 * Never blocks and never rewrites either value (ADR 0008) — this only
 * reports which of the three outcomes applies.
 *
 * No server call site: the disagreement is shown, not enforced, and the showing
 * happens in `frontend/src/helpers/reviewRequest.js#reviewPullRequestMismatch`.
 * Stated here too because this file is the authoritative copy of the rule — if
 * the server ever needs the comparison (a History line, a digest), it takes it
 * from here rather than growing a second definition.
 */
const detectPullRequestMismatch = ({ prNumber, linkedPrNumber }) => {
  if (!prNumber || !linkedPrNumber) return MISMATCH.NO_COMPARISON;
  return Number(prNumber) === Number(linkedPrNumber) ? MISMATCH.AGREES : MISMATCH.DISAGREES;
};

/** History phrasing for each transition, kept in one place so wording can't drift between call sites. */
const describeReviewRequestHistory = (transition, ctx = {}) => {
  switch (transition) {
    case 'requested':
      return `Review requested from ${ctx.reviewerName || 'a mentor'}`;
    case 'cancelled':
      return `Review request cancelled by ${ctx.actorName || 'a user'}`;
    case 'approved':
      return 'Review approved';
    case 'changes_requested':
      return 'Changes requested';
    case 'stale':
      return `Review request dropped — the ticket is ${ctx.reason === 'archived' ? 'archived' : 'done'}`;
    default:
      throw new Error(`Unknown review-request transition: ${transition}`);
  }
};

module.exports = {
  CANDIDATE_EMPTY_CAUSES,
  INVALID_STATE_ERROR,
  MISMATCH,
  MISSING_PR_URL_ERROR,
  NOT_ASSIGNEE_ERROR,
  NOT_INTERN_ERROR,
  NOT_MENTOR_ERROR,
  NOT_PARTY_ERROR,
  NOT_PENDING_ERROR,
  NOT_REVIEWER_ERROR,
  PR_URL_ERROR,
  REVIEWER_NOT_MEMBER_ERROR,
  REVIEW_REQUEST_STATES,
  answerReviewRequest,
  assertCanAnswerReview,
  assertCanCancelReview,
  assertCanRequestReview,
  assertReviewerEligible,
  buildReviewRequest,
  describeReviewRequestHistory,
  detectPullRequestMismatch,
  isReviewRequestStale,
  parsePullRequestUrl,
  resolveReviewerCandidates,
};
