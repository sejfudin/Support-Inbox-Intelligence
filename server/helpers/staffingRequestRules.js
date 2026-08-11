// Pure rules for staffing-request decisions (progress, demand-met, display
// state, edit legality, close/reopen legality). No I/O, no clock — timestamps
// are always passed in so callers control them and this stays trivially
// unit-testable. Follows helpers/specializationRules.js exactly.

const CLOSE_REASONS = ['fulfilled', 'declined', 'cancelled'];

const idEquals = (a, b) => a != null && b != null && String(a) === String(b);

// Per requested position: how many are wanted, how many were put forward
// (any recommendation tagged to this request for that position), and how
// many of those were actually placed. Recommendations tagged to the request
// whose position doesn't match any requested position are ignored — they
// cannot happen through the normal fulfil flow, and are not attributable to
// any position's counts.
const deriveProgress = (requestedPositions, recommendations) => {
  const positions = requestedPositions.map((requestedPosition) => {
    const matching = recommendations.filter((recommendation) =>
      idEquals(recommendation.position, requestedPosition.position)
    );
    const placed = matching.filter(
      (recommendation) => recommendation.result?.outcome === 'placed'
    ).length;
    return {
      position: requestedPosition.position,
      wanted: requestedPosition.count,
      putForward: matching.length,
      placed,
    };
  });

  const totals = positions.reduce(
    (acc, position) => ({
      wanted: acc.wanted + position.wanted,
      putForward: acc.putForward + position.putForward,
      placed: acc.placed + position.placed,
    }),
    { wanted: 0, putForward: 0, placed: 0 }
  );

  return { positions, totals };
};

// Auto-close predicate: every requested position has at least as many
// placed as wanted. A request with no requested positions is vacuously met,
// but the model requires at least one, so this never arises in practice.
const isDemandMet = (progress) =>
  progress.positions.every((position) => position.placed >= position.wanted);

// The pill a request displays. Closed reasons win over everything else,
// except that a request can never read "fulfilled" while its project is
// still a draft (fulfilling requires a resolved project, so a request in
// that state is a data-integrity violation, not a legitimate display case) —
// and a closed(fulfilled) request whose recommendations have since dropped
// below demand reads "placement lost" instead, since nothing auto-reopens.
const deriveDisplayState = (request, progress) => {
  const projectResolved = Boolean(request.project);

  if (request.status === 'closed') {
    if (!CLOSE_REASONS.includes(request.reason)) {
      throw new Error(`Invalid close reason: ${request.reason}`);
    }
    if (request.reason === 'cancelled') return { state: 'cancelled' };
    if (request.reason === 'declined') return { state: 'declined' };
    // reason === 'fulfilled'
    if (!projectResolved) {
      throw new Error('A draft-project request can never be fulfilled');
    }
    return isDemandMet(progress) ? { state: 'fulfilled' } : { state: 'placement_lost' };
  }

  if (!projectResolved) return { state: 'needs_project' };
  if (progress.totals.putForward === 0) return { state: 'sourcing' };
  return { state: 'put_forward', putForward: progress.totals.putForward };
};

// Whether the project reference may still be changed / resolved.
const assertProjectEditable = (request, { hasRecommendations }) => {
  if (request.status === 'closed') {
    throw new Error('Cannot edit a closed staffing request');
  }
  if (hasRecommendations) {
    throw new Error('Project is locked once recommendations exist');
  }
};

// Whether a proposed requestedPositions array may replace the current one.
// `positionsWithRecommendations` are the position ids of requested positions
// that currently have recommendations tagged against them — those cannot be
// dropped, though their count may still fall below their placed count.
const assertRequestedPositionsEditable = (
  request,
  nextRequestedPositions,
  positionsWithRecommendations = []
) => {
  if (request.status === 'closed') {
    throw new Error('Cannot edit a closed staffing request');
  }

  const seen = new Set();
  for (const requestedPosition of nextRequestedPositions) {
    const key = String(requestedPosition.position);
    if (seen.has(key)) {
      throw new Error(`Duplicate position: ${key}`);
    }
    seen.add(key);
    if (!Number.isInteger(requestedPosition.count) || requestedPosition.count < 1) {
      throw new Error('Count must be an integer of at least 1');
    }
  }

  for (const positionId of positionsWithRecommendations) {
    if (!seen.has(String(positionId))) {
      throw new Error(`Cannot delete requested position with recommendations: ${positionId}`);
    }
  }
};

// Who may close a request with which reason, and under what conditions.
// `cancelled` is available to the author or an admin; `fulfilled` and
// `declined` are admin-only, and `declined` requires a non-empty note.
const assertCanClose = (request, { isAdmin, isAuthor, reason, note }) => {
  if (request.status === 'closed') {
    throw new Error('Staffing request is already closed');
  }
  if (!CLOSE_REASONS.includes(reason)) {
    throw new Error(`Invalid close reason: ${reason}`);
  }

  if (reason === 'cancelled') {
    if (!isAdmin && !isAuthor) {
      throw new Error('Only the author or an admin may cancel a staffing request');
    }
    return;
  }

  if (!isAdmin) {
    throw new Error(`Only an admin may close a staffing request as ${reason}`);
  }
  if (reason === 'declined' && !note?.trim()) {
    throw new Error('Declining a staffing request requires a non-empty note');
  }
};

// The change set to persist when a close decision has already been found
// legal by assertCanClose.
const applyClose = (request, { reason, closedBy, closedAt }) => ({
  status: 'closed',
  reason,
  closedBy,
  closedAt,
});

// Reopening is available from either terminal reason, to the author or an
// admin, and always clears the close markers — nothing ever auto-reopens.
const assertCanReopen = (request, { isAdmin, isAuthor }) => {
  if (request.status !== 'closed') {
    throw new Error('Staffing request is not closed');
  }
  if (!isAdmin && !isAuthor) {
    throw new Error('Only the author or an admin may reopen a staffing request');
  }
};

const applyReopen = () => ({
  status: 'open',
  reason: null,
  closedBy: null,
  closedAt: null,
});

module.exports = {
  deriveProgress,
  isDemandMet,
  deriveDisplayState,
  assertProjectEditable,
  assertRequestedPositionsEditable,
  assertCanClose,
  applyClose,
  assertCanReopen,
  applyReopen,
};
