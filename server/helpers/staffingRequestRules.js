// Pure rules for staffing-request decisions (progress, edit legality,
// close/reopen legality). No I/O, no clock — timestamps are always passed in
// so callers control them and this stays trivially unit-testable. Follows
// helpers/specializationRules.js exactly.
//
// There is deliberately no derived "display state" here. A request is `open`
// or `closed`, plus a close `reason` — everything a UI used to read off a
// single pill (nobody suggested yet, N put forward, demand met, project still
// a draft) is a plain comparison on `progress` or `project`, so the response
// carries the facts and the client presents them. Authority stays here: the
// `assert*` functions below are the only thing that decides what is legal.

const CLOSE_REASONS = ['fulfilled', 'declined', 'cancelled'];

// A position reference reaches here either as a raw ObjectId or, on the request
// side, as a POPULATED document — `REQUEST_POPULATE` in staffingRequestService
// populates `requestedPositions.position` so the UI has a name to show. Without
// this unwrap, `String(populatedDoc)` is '[object Object]', nothing ever matches
// a recommendation's raw id, and every count silently reads 0.
const toId = (value) => (value && typeof value === 'object' && value._id ? value._id : value);

const idEquals = (a, b) => {
  const left = toId(a);
  const right = toId(b);
  return left != null && right != null && String(left) === String(right);
};

// "You may not do this", as opposed to "this is not a legal thing to do".
// Callers map the code to a 403 and everything else to a 400 — this module
// stays free of HTTP knowledge, it just says which kind of refusal it is.
const forbidden = (message) => {
  const error = new Error(message);
  error.code = 'FORBIDDEN';
  return error;
};

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
      // Always the id, never the populated document: this field is an
      // identifier the client pairs back against its own requestedPositions,
      // and a document here fails that comparison the same way it fails the
      // one above.
      position: toId(requestedPosition.position),
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
      throw forbidden('Only the author or an admin may cancel a staffing request');
    }
    return;
  }

  if (!isAdmin) {
    throw forbidden(`Only an admin may close a staffing request as ${reason}`);
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
    throw forbidden('Only the author or an admin may reopen a staffing request');
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
  assertProjectEditable,
  assertRequestedPositionsEditable,
  assertCanClose,
  applyClose,
  assertCanReopen,
  applyReopen,
};
