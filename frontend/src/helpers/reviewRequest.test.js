import { describe, expect, it } from 'vitest';
import {
  MISSING_PR_URL_ERROR,
  PR_URL_ERROR,
  parsePullRequestNumber,
  reviewChipLabel,
  reviewChipTone,
  reviewOverflowCaption,
  reviewPullRequestMismatch,
  validatePullRequestUrl,
} from './reviewRequest';

describe('validatePullRequestUrl', () => {
  it('accepts a well-formed GitHub pull request URL', () => {
    expect(validatePullRequestUrl('https://github.com/acme/widgets/pull/42')).toBeNull();
  });

  it('reports a missing URL distinctly from a malformed one', () => {
    expect(validatePullRequestUrl('')).toBe(MISSING_PR_URL_ERROR);
    expect(validatePullRequestUrl('   ')).toBe(MISSING_PR_URL_ERROR);
    expect(validatePullRequestUrl(undefined)).toBe(MISSING_PR_URL_ERROR);
  });

  it.each([
    ['a compare link', 'https://github.com/acme/widgets/compare/main...feature'],
    ['a commit link', 'https://github.com/acme/widgets/commit/abc123'],
    ['a non-GitHub host', 'https://gitlab.com/acme/widgets/pull/42'],
    ['plain http', 'http://github.com/acme/widgets/pull/42'],
  ])('rejects %s with the shape error', (_label, url) => {
    expect(validatePullRequestUrl(url)).toBe(PR_URL_ERROR);
  });
});

describe('parsePullRequestNumber', () => {
  it('extracts the PR number from a well-formed URL', () => {
    expect(parsePullRequestNumber('https://github.com/acme/widgets/pull/42')).toBe(42);
  });

  it('returns null for anything else', () => {
    expect(parsePullRequestNumber('not a url')).toBeNull();
    expect(parsePullRequestNumber('')).toBeNull();
  });
});

describe('reviewPullRequestMismatch', () => {
  it('is false when there is nothing to compare against', () => {
    expect(reviewPullRequestMismatch({ prUrl: 'https://github.com/acme/widgets/pull/42' })).toBe(
      false
    );
  });

  it('is false when the numbers agree', () => {
    expect(
      reviewPullRequestMismatch({
        prUrl: 'https://github.com/acme/widgets/pull/42',
        linkedPrNumber: 42,
      })
    ).toBe(false);
  });

  it('is true when the numbers disagree — a warning, never computed as a block', () => {
    expect(
      reviewPullRequestMismatch({
        prUrl: 'https://github.com/acme/widgets/pull/42',
        linkedPrNumber: 7,
      })
    ).toBe(true);
  });
});

describe('chip label and tone', () => {
  it.each([
    ['pending', 'Review pending', 'info'],
    ['approved', 'Review approved', 'success'],
    ['changes_requested', 'Changes requested', 'warning'],
  ])('renders %s as %s / %s', (state, label, tone) => {
    expect(reviewChipLabel({ state })).toBe(label);
    expect(reviewChipTone({ state })).toBe(tone);
  });

  it('renders nothing for no request', () => {
    expect(reviewChipLabel(null)).toBeNull();
  });
});

describe('reviewOverflowCaption', () => {
  it('reports the true total against the shown count', () => {
    expect(reviewOverflowCaption({ shown: 3, total: 7 })).toBe('3 of 7');
  });

  it('handles the singular case', () => {
    expect(reviewOverflowCaption({ shown: 1, total: 1 })).toBe('1 of 1');
  });

  it('names the empty state instead of "0 of 0"', () => {
    expect(reviewOverflowCaption({ shown: 0, total: 0 })).toBe('Nothing waiting on your review');
  });
});
