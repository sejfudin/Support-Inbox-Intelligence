// Pure rules for staffing-request decisions (progress, edit legality,
// close/reopen legality). No I/O, no clock — timestamps are always passed in
// so callers control them and this stays trivially unit-testable. Follows
// helpers/specializationRules.js exactly.
//
// Display state stays minimal: most of what a UI wants to say (nobody
// suggested yet, N put forward, demand met) is a plain comparison on
// `progress`, so the response carries the facts and the client presents them.
// The one state worth deriving here is "needs project" — it is not just a
// presentation nicety, it is also what `assertCanClose` below refuses to let
// become `fulfilled`, so both live next to each other. Authority stays here:
// the `assert*` functions are the only thing that decides what is legal.

const CLOSE_REASONS = ['fulfilled', 'declined', 'cancelled'];

// A recommendation is live until an outcome has been written for it. Mirrors
// ACTIVE_PIPELINE_STATUSES in recommendationService — the same lifecycle read
// from the demand side.
const IN_SELECTION_STATUSES = ['recommended', 'interviewing'];

// Offering one of these interns is always a mistake, so they never reach the
// picker at all. Everything else is at most a warning.
const PICKER_EXCLUDED_INTERN_STATUSES = ['discontinued', 'completed'];

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

// The distinct project names behind a set of recommendations, in the order they
// were first seen — an intern can have several recommendations on one project,
// and naming it twice reads as two different double-bookings.
const projectNames = (recommendations) => [
  ...new Set(
    recommendations
      .map((recommendation) => recommendation.project?.name)
      .filter((name) => Boolean(name))
  ),
];

// "You may not do this", as opposed to "this is not a legal thing to do".
// Callers map the code to a 403 and everything else to a 400 — this module
// stays free of HTTP knowledge, it just says which kind of refusal it is.
const forbidden = (message) => {
  const error = new Error(message);
  error.code = 'FORBIDDEN';
  return error;
};

// Per requested position: how many are wanted, how many were put forward (any
// recommendation tagged to this request for that position), how many of those
// are still in selection, and how many were actually placed. Recommendations
// tagged to the request whose position doesn't match any requested position are
// ignored — they cannot happen through the normal put-forward flow, and are not
// attributable to any position's counts.
//
// Three numbers, never one collapsed badge. `putForward` counts every
// recommendation ever tagged here, including ones since resolved, so on its own
// it reports a full pipeline for candidates who are all finished. `inSelection`
// is the number that says whether anyone is still live.
const deriveProgress = (requestedPositions, recommendations) => {
  const positions = requestedPositions.map((requestedPosition) => {
    const matching = recommendations.filter((recommendation) =>
      idEquals(recommendation.position, requestedPosition.position)
    );
    const placed = matching.filter(
      (recommendation) => recommendation.result?.outcome === 'placed'
    ).length;
    const inSelection = matching.filter((recommendation) =>
      IN_SELECTION_STATUSES.includes(recommendation.status)
    ).length;
    return {
      // Always the id, never the populated document: this field is an
      // identifier the client pairs back against its own requestedPositions,
      // and a document here fails that comparison the same way it fails the
      // one above.
      position: toId(requestedPosition.position),
      wanted: requestedPosition.count,
      putForward: matching.length,
      inSelection,
      placed,
    };
  });

  const totals = positions.reduce(
    (acc, position) => ({
      wanted: acc.wanted + position.wanted,
      putForward: acc.putForward + position.putForward,
      inSelection: acc.inSelection + position.inSelection,
      placed: acc.placed + position.placed,
    }),
    { wanted: 0, putForward: 0, inSelection: 0, placed: 0 }
  );

  return { positions, totals };
};

// Whether every requested position has as many interns placed as it wanted.
// This is a prompt, not an action: it drives the admin's "close as fulfilled"
// banner, and nothing anywhere closes a request off the back of it. A request
// with no requested positions is never met — an empty `every()` is vacuously
// true, and calling a request with no demand "met" is nonsense.
const isDemandMet = (progress) =>
  progress.positions.length > 0 &&
  progress.positions.every((position) => position.placed >= position.wanted);

// Partition the interns a picker could offer into the ones it must not show,
// the ones it shows with a flag, and the ones it shows plainly.
//
// Excluded interns are absent from the picker outright. Everything else is
// shown and selectable: putting forward someone already placed or already in
// selection elsewhere is legitimate when a process falls through or a stronger
// opportunity appears, and blocking it would just get worked around by editing
// recommendations directly. So we name where, and let the admin decide.
//
// Each candidate arrives as `{ internProfile, status, recommendations }`, where
// `recommendations` are that intern's recommendations across all projects.
// Flags are data, never copy — the client writes the sentence.
const partitionPickerCandidates = (
  candidates,
  { projectId = null, alreadyPutForwardProfileIds = [] } = {}
) => {
  const alreadyPutForward = new Set(alreadyPutForwardProfileIds.map((id) => String(toId(id))));
  const result = { excluded: [], warned: [], clean: [] };

  for (const candidate of candidates) {
    const flags = [];

    if (PICKER_EXCLUDED_INTERN_STATUSES.includes(candidate.status)) {
      flags.push({ type: candidate.status });
    } else if (alreadyPutForward.has(String(toId(candidate.internProfile)))) {
      flags.push({ type: 'already-put-forward' });
    }

    if (flags.length > 0) {
      result.excluded.push({
        internProfile: candidate.internProfile,
        eligibility: 'excluded',
        flags,
      });
      continue;
    }

    const recommendations = candidate.recommendations ?? [];
    // Gated on the intern being placed *now*, not on ever having been: a
    // historical placement on a project they have since finished is not a
    // conflict, and flagging it would put a warning on most of the programme.
    // The projects come from the recommendations because the profile only
    // records that they are placed, never where.
    const placedOn =
      candidate.status === 'placed'
        ? projectNames(
            recommendations.filter((recommendation) => recommendation.result?.outcome === 'placed')
          )
        : [];
    // Being in selection for the project being staffed is this request's own
    // pipeline, not a double-booking worth flagging.
    const inSelectionOn = projectNames(
      recommendations.filter(
        (recommendation) =>
          IN_SELECTION_STATUSES.includes(recommendation.status) &&
          !(projectId && idEquals(recommendation.project, projectId))
      )
    );

    if (placedOn.length > 0) flags.push({ type: 'placed', projects: placedOn });
    if (inSelectionOn.length > 0) flags.push({ type: 'in-selection', projects: inSelectionOn });

    const bucket = flags.length > 0 ? result.warned : result.clean;
    bucket.push({
      internProfile: candidate.internProfile,
      eligibility: flags.length > 0 ? 'warned' : 'clean',
      flags,
    });
  }

  return result;
};

// Whether an admin may put interns forward against this request. Both refusals
// are enforced here rather than only hidden in the UI: `Recommendation.project`
// is a required reference, so an unresolved draft project has nothing to create
// a recommendation against.
const assertCanPutForward = (request, { isAdmin }) => {
  if (!isAdmin) {
    throw forbidden('Only an admin may put interns forward against a staffing request');
  }
  if (request.status === 'closed') {
    throw new Error('Cannot put interns forward against a closed staffing request');
  }
  if (needsProject(request)) {
    throw new Error('Resolve the project before putting interns forward');
  }
};

// A request has no real project yet — filed with `draftProject` only, and
// nobody can be put forward against it (`Recommendation.project` is a
// required reference). This is the one display state derived here rather
// than left as a plain comparison in the client: `assertCanClose` below
// enforces it can never resolve to `fulfilled`, so the definition needs to
// live in exactly one place.
const needsProject = (request) => !request.project;

// Whether an unresolved request may be linked to a project. Resolving twice
// or resolving a closed request are both refused — a project reference, once
// set, is only ever moved through the edit path, not through resolution again.
// There is no lock: putting interns forward never freezes the project, because
// repointing a request only ever means the wrong project was named.
const assertCanResolveProject = (request) => {
  if (request.status === 'closed') {
    throw new Error('Cannot resolve a closed staffing request');
  }
  if (request.project) {
    throw new Error('This request already has a project');
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
  // A request that only names a draft project can never be marked fulfilled
  // — there is no real project for anyone to have been placed against.
  // Enforced here, not only hidden in the UI, so the refusal holds even if a
  // client is out of date or bypassed entirely.
  if (reason === 'fulfilled' && needsProject(request)) {
    throw new Error('Cannot close as fulfilled while the request needs a project');
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

// Which requests carry "news" a viewer hasn't seen yet, from their raw
// history events (each `{ entityId, userId, timestamp }`). A viewer who has
// never opened the tab (`lastSeenAt` nullish) sees news for everything —
// there is no earlier "caught up" moment to compare against. An event is only
// "new" if it is strictly newer than `lastSeenAt`: one landing at the exact
// last-seen instant was already visible the moment that instant was stamped.
// Events the viewer themselves caused never count, however they arrived.
const deriveUnreadStaffingRequestIds = (events, { lastSeenAt, viewerId }) => {
  const unread = new Set();
  for (const event of events) {
    if (idEquals(event.userId, viewerId)) continue;
    if (lastSeenAt && !(event.timestamp > lastSeenAt)) continue;
    unread.add(String(toId(event.entityId)));
  }
  return unread;
};

module.exports = {
  IN_SELECTION_STATUSES,
  PICKER_EXCLUDED_INTERN_STATUSES,
  deriveProgress,
  isDemandMet,
  partitionPickerCandidates,
  needsProject,
  assertCanResolveProject,
  assertRequestedPositionsEditable,
  assertCanPutForward,
  assertCanClose,
  applyClose,
  assertCanReopen,
  applyReopen,
  deriveUnreadStaffingRequestIds,
};
