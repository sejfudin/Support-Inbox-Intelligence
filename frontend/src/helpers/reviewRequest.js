/**
 * Client-side mirror of `server/helpers/reviewRequestRules.js` — the rules for
 * a ticket's review request: an intern asking one of their own mentors to
 * look at a pull request, and the mentor answering approved or changes
 * requested.
 *
 * The two sides are separate packages (CommonJS vs ESM), so the URL shape and
 * the state vocabulary are stated twice on purpose, the same way the two
 * `ticketBlocker` helpers already are. The server is authoritative: this is
 * for showing the field, keeping the Save button honest, and picking a chip
 * label/tone — never the source of truth for whether a request is legal.
 */

export const PR_URL_PATTERN = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)$/;

export const MISSING_PR_URL_ERROR = 'A pull request URL is required to request a review';
export const PR_URL_ERROR =
  'Pull request URL must look like https://github.com/<owner>/<repo>/pull/<number>';

/** Same two-step validation as the server: missing vs. wrong shape are distinct. */
export const validatePullRequestUrl = (rawUrl) => {
  const url = String(rawUrl || '').trim();
  if (!url) return MISSING_PR_URL_ERROR;
  if (!PR_URL_PATTERN.test(url)) return PR_URL_ERROR;
  return null;
};

export const parsePullRequestNumber = (rawUrl) => {
  const match = PR_URL_PATTERN.exec(String(rawUrl || '').trim());
  return match ? Number(match[3]) : null;
};

/** Never blocks, never rewrites either value — ADR 0008. Just what to show. */
export const reviewPullRequestMismatch = ({ prUrl, linkedPrNumber }) => {
  const prNumber = parsePullRequestNumber(prUrl);
  if (!prNumber || !linkedPrNumber) return false;
  return Number(prNumber) !== Number(linkedPrNumber);
};

export const REVIEW_CHIP_TONE = {
  pending: 'info',
  approved: 'success',
  changes_requested: 'warning',
};

export const REVIEW_CHIP_LABEL = {
  pending: 'Review pending',
  approved: 'Review approved',
  changes_requested: 'Changes requested',
};

export const reviewChipLabel = (reviewRequest) => REVIEW_CHIP_LABEL[reviewRequest?.state] || null;

export const reviewChipTone = (reviewRequest) => REVIEW_CHIP_TONE[reviewRequest?.state] || 'info';

/**
 * The dashboard card's "3 of 7" header — `shown` is the row count actually
 * rendered (capped), `total` is the true count. Singular reads "1 of 1", not
 * "1 of 1 reviews".
 */
export const reviewOverflowCaption = ({ shown, total }) => {
  if (total <= 0) return 'Nothing waiting on your review';
  return `${Math.min(shown, total)} of ${total}`;
};
