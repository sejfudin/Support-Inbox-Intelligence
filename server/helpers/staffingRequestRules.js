// Pure rules for staffing-request decisions (progress, edit legality, close
// legality, and which candidates a close takes down with it). No I/O, no clock
// — timestamps are always passed in so callers control them and this stays
// trivially unit-testable. Follows helpers/specializationRules.js exactly.
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

// "You may not do this", as opposed to "this is not a legal thing to do" — the
// two refusals this module makes, and they map to different statuses. A plain
// `Error` means the move is illegal (400); this one means the caller is the
// wrong person for a move that is otherwise fine (403).
//
// A class rather than a factory, per `.claude/docs/conventions.md`: an error
// carrying more than a message follows `StatusValidationError`, which is also
// where the `statusCode` field comes from. Carrying the status here rather than
// a private code string means callers map it the same way they map every other
// tagged error in the codebase, instead of knowing a protocol only this module
// speaks.
class StaffingRequestForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StaffingRequestForbiddenError';
    this.statusCode = 403;
  }
}

// A submit that was refused per pick rather than outright: legal request, legal
// admin, but some of the staged picks went stale between staging and sending.
// It carries the per-pick reasons in `data` so the client can mark the offending
// rows and let the admin send the rest — the whole point of the refusal is that
// it is addressable, which a bare message cannot be.
class StagedPickRejectionError extends Error {
  constructor(rejections) {
    super('Some picks could not be sent');
    this.name = 'StagedPickRejectionError';
    this.statusCode = 409;
    this.data = { rejections };
  }
}

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
    throw new StaffingRequestForbiddenError(
      'Only an admin may put interns forward against a staffing request'
    );
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

// "Ana", "Ana and Ben", "Ana, Ben and Cara" — a refusal reads as a sentence, so
// the names in it have to as well.
const nameList = (names) => {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

const internName = (recommendation) =>
  recommendation.internName ?? recommendation.internProfile?.user?.fullname ?? 'someone';

// What an edit is allowed to do, and what it costs. One call answers both,
// because the cost *is* what decides legality: a position nobody is placed
// against may end, and ending it closes out whoever is still in selection for
// it (ADR 0004's cascade, reused per position rather than per request).
//
// Everything the old lock refused on `putForward > 0` is permitted here.
// Being considered is not a fact worth blocking an edit over — being placed is,
// because the request's record of a placement it produced would go with the
// line. A count may fall below what is already placed ("1 wanted, 2 placed" is
// a truthful state), and lowering a count closes out nobody: nothing here can
// pick which of three candidates to drop.
//
// A position "changing" and a position being "removed" are the same event —
// `requestedPositions` has no per-row id, so a line is only ever identified by
// its position — which is why both cascade identically.
//
// `recommendations` are the ones tagged to this request, in the same shape
// `deriveProgress` takes. Returns the consequences the caller has to carry out
// and warn about; throws when the edit is not permitted at all.
const planStaffingRequestEdit = (
  request,
  { requestedPositions, projectId } = {},
  recommendations = []
) => {
  if (request.status === 'closed') {
    throw new Error('Cannot edit a closed staffing request');
  }

  const next = requestedPositions ?? request.requestedPositions ?? [];
  const seen = new Set();
  for (const requestedPosition of next) {
    const key = String(toId(requestedPosition.position));
    if (seen.has(key)) {
      throw new Error(`Duplicate position: ${key}`);
    }
    seen.add(key);
    if (!Number.isInteger(requestedPosition.count) || requestedPosition.count < 1) {
      throw new Error('Count must be an integer of at least 1');
    }
  }

  const ending = (request.requestedPositions ?? []).filter(
    (requestedPosition) => !seen.has(String(toId(requestedPosition.position)))
  );

  for (const requestedPosition of ending) {
    const placed = recommendations.filter(
      (recommendation) =>
        recommendation.result?.outcome === 'placed' &&
        idEquals(recommendation.position, requestedPosition.position)
    );
    if (placed.length > 0) {
      const label = requestedPosition.position?.name ?? String(toId(requestedPosition.position));
      const who = nameList(placed.map(internName));
      throw new Error(
        `${label} can't be changed, ${who} ${placed.length === 1 ? 'is' : 'are'} already placed against it`
      );
    }
  }

  const endingPositionIds = ending.map((requestedPosition) => toId(requestedPosition.position));

  // Repointing a request only ever means the wrong project was named, so the
  // move is never refused — not even with someone placed, which is exactly when
  // fixing the name matters most. Naming the *first* project is a different act
  // with a different guard (`assertCanResolveProject`), so it is refused here.
  let projectChanged = false;
  if (projectId != null && !idEquals(request.project, projectId)) {
    if (!request.project) {
      throw new Error('Resolve the project before moving it');
    }
    projectChanged = true;
  }

  return {
    endingPositionIds,
    closeOutCount: selectCloseOutRecommendations(recommendations, endingPositionIds).length,
    projectChanged,
    movingCount: projectChanged ? recommendations.length : 0,
  };
};

// Who may close a request with which reason, and under what conditions. One
// sentence covers the split: leadership withdraws, admin answers. `cancelled`
// is leadership-only — they are the ones who speak to the outside party, so
// only they can state the demand is gone — and any leadership user qualifies,
// not only the author, because the ask belongs to the side that made it rather
// than to one person's account. `fulfilled` and `declined` are admin-only.
//
// Ending a request that was never answered requires a non-empty reason —
// `declined` and `cancelled` both. Those are the two closes that leave the ask
// unmet, and the record is the only account anyone gets of why: there is no
// reopen, and the note can no longer be changed afterwards. `fulfilled` needs
// none, because the placements are the explanation.
//
// `inSelectionCount` is how many candidates the close will resolve (see
// `selectCloseOutRecommendations`). Whenever that is above zero the close needs
// a `notPlacedReason` as well: the cascade writes it onto other people's
// records, and a blank one would leave every closed-out intern with no stated
// reason at all.
const assertCanClose = (
  request,
  { isAdmin, isLeadership, reason, note, notPlacedReason, inSelectionCount = 0 }
) => {
  if (request.status === 'closed') {
    throw new Error('Staffing request is already closed');
  }
  if (!CLOSE_REASONS.includes(reason)) {
    throw new Error(`Invalid close reason: ${reason}`);
  }

  if (reason === 'cancelled') {
    if (!isLeadership) {
      throw new StaffingRequestForbiddenError('Only leadership may cancel a staffing request');
    }
  } else if (!isAdmin) {
    throw new StaffingRequestForbiddenError(
      `Only an admin may close a staffing request as ${reason}`
    );
  }

  // A request that only names a draft project can never be marked fulfilled
  // — there is no real project for anyone to have been placed against.
  // Enforced here, not only hidden in the UI, so the refusal holds even if a
  // client is out of date or bypassed entirely.
  if (reason === 'fulfilled' && needsProject(request)) {
    throw new Error('Cannot close as fulfilled while the request needs a project');
  }
  if (reason !== 'fulfilled' && !note?.trim()) {
    const verb = reason === 'declined' ? 'Declining' : 'Cancelling';
    throw new Error(`${verb} a staffing request requires a non-empty reason`);
  }
  if (inSelectionCount > 0 && !notPlacedReason?.trim()) {
    throw new Error('Closing out candidates requires a reason');
  }
};

// The recommendations a close (or an edit that drops demand) resolves: the ones
// tagged to the request that are still in selection for one of `positionIds`.
//
// Placed interns fall out for free — a placement moves the recommendation to
// `resulted`, so it is not in selection — and that is deliberate: placement is
// a fact about the intern, not about the demand. A tagged recommendation whose
// position is no longer requested falls out too, the same way `deriveProgress`
// ignores it, because it is not attributable to any of the positions being
// ended.
//
// Pure and position-scoped so ticket 10's edit path can reuse it for a single
// changed or removed position rather than the whole request.
const selectCloseOutRecommendations = (recommendations, positionIds) => {
  const ending = new Set(positionIds.map((positionId) => String(toId(positionId))));
  return recommendations.filter(
    (recommendation) =>
      IN_SELECTION_STATUSES.includes(recommendation.status) &&
      ending.has(String(toId(recommendation.position)))
  );
};

// The change set to persist when a close decision has already been found
// legal by assertCanClose.
const applyClose = (request, { reason, closedBy, closedAt }) => ({
  status: 'closed',
  reason,
  closedBy,
  closedAt,
});

// There is no reopen: `closed` is terminal (ADR 0005). A close resolves
// everyone still in selection, so a reopened request would come back with
// nobody live on it — a fresh request wearing an old date, with notes
// explaining why it was cancelled. A mis-close is corrected by filing the ask
// again; the dead request keeps the reason it was closed with, and nothing on a
// closed request is writable — which is why that reason is mandatory.

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
  StaffingRequestForbiddenError,
  StagedPickRejectionError,
  IN_SELECTION_STATUSES,
  PICKER_EXCLUDED_INTERN_STATUSES,
  deriveProgress,
  partitionPickerCandidates,
  needsProject,
  assertCanResolveProject,
  planStaffingRequestEdit,
  assertCanPutForward,
  assertCanClose,
  applyClose,
  selectCloseOutRecommendations,
  deriveUnreadStaffingRequestIds,
};
