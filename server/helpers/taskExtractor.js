const PATTERNS = {
  // Branch patterns - strict prefix separators
  BRANCH_SLASH_PREFIX: /^[^/]+\/(\d+)(?:-|$)/,           // feature/87-xyz, bugfix/123
  BRANCH_HYPHEN_PREFIX: /^[a-z]+-(\d+)(?:-|$)/i,          // TICK-123, BUG-456
  BRANCH_UNDERSCORE_PREFIX: /^[a-z]+_(\d+)(?:_|$)/i,     // TICK_123, issue_456

  // Text patterns - with markers
  HASH_PREFIX: /#(\d+)/,                                 // #87, #123
  TICK_PREFIX: /\btick(?:et)?-?(\d+)/i,                  // TICK-87, TICKET-123, tick456
  TASK_PREFIX: /\btask[-\s]?#?(\d+)/i,                  // Task #87, Task-123, Task 16
  ISSUE_PREFIX: /\bissue[-\s]?#?(\d+)/i,                // Issue #87, Issue-123

  // Word boundary patterns - standalone numbers
  BOUNDED_NUMBER: /\b(\d{1,6})\b/,
};

// Priority order for pattern matching
const PRIORITY_ORDER = [
  'BRANCH_SLASH_PREFIX',
  'BRANCH_HYPHEN_PREFIX',
  'BRANCH_UNDERSCORE_PREFIX',
  'HASH_PREFIX',
  'TICK_PREFIX',
  'TASK_PREFIX',
  'ISSUE_PREFIX',
  'BOUNDED_NUMBER',
];

/**
 * Extract task number from a single text string using all patterns
 * @param {string} text - Text to parse
 * @returns {number|null} - Extracted task number or null
 */
function extractFromText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const normalized = text.trim();

  for (const patternName of PRIORITY_ORDER) {
    const pattern = PATTERNS[patternName];
    const match = normalized.match(pattern);

    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 999999) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Extract task number from PR data (branch, title)
 * Priority: branch name > PR title
 * @param {Object} prData - Pull request data
 * @param {string} prData.branchName - Branch name (e.g., "feature/87-fix")
 * @param {string} prData.title - PR title
 * @returns {number|null} - Extracted task number or null
 */
function extractTaskNumber(prData) {
  if (!prData || typeof prData !== 'object') {
    return null;
  }

  const { branchName, title } = prData;

  // Priority 1: Branch name (most reliable)
  if (branchName) {
    const fromBranch = extractFromBranch(branchName);
    if (fromBranch !== null) {
      return fromBranch;
    }
  }

  // Priority 2: PR title
  if (title) {
    const fromTitle = extractFromText(title);
    if (fromTitle !== null) {
      return fromTitle;
    }
  }

  return null;
}

/**
 * Branch-specific extraction with stricter patterns
 * Branch names follow conventions like: feature/87-description
 * @param {string} branchName - Git branch name
 * @returns {number|null}
 */
function extractFromBranch(branchName) {
  if (!branchName || typeof branchName !== 'string') {
    return null;
  }

  // Normalize: remove refs/heads/ prefix if present
  const normalized = branchName.replace(/^refs\/heads\//, '');

  // Pattern 1: prefix/NUMBER-description (most common)
  // feature/87-xyz, bugfix/123, hotfix/456, feature/1
  const slashMatch = normalized.match(/^[^/]+\/(\d+)(?:[-_.]|\b|$)/);
  if (slashMatch) {
    const num = parseInt(slashMatch[1], 10);
    if (num > 0 && num <= 999999) {
      return num;
    }
  }

  // Pattern 2: TICK-123-description, BUG_456, etc.
  const prefixMatch = normalized.match(/^[a-z]+[-_](\d+)(?:[-_]|$)/i);
  if (prefixMatch) {
    const num = parseInt(prefixMatch[1], 10);
    if (num > 0 && num <= 999999) {
      return num;
    }
  }

  // Pattern 3: issue-123, ticket-456
  const keywordMatch = normalized.match(/^(?:issue|ticket|task|fix|feat)[-_]?(\d+)(?:[-_]|$)/i);
  if (keywordMatch) {
    const num = parseInt(keywordMatch[1], 10);
    if (num > 0 && num <= 999999) {
      return num;
    }
  }

  return null;
}

/**
 * Check if text contains a task reference (boolean check)
 * @param {string} text - Text to check
 * @returns {boolean}
 */
function hasTaskReference(text) {
  return extractFromText(text) !== null;
}

module.exports = {
  extractTaskNumber,
  extractFromBranch,
  extractFromText,
  hasTaskReference,
};
