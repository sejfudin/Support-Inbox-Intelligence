// A request is `open` or `closed`. When closed it carries a `reason`, and the
// reason is the outcome — leadership needs "you got your people" (fulfilled)
// to look nothing like "admin said no" (declined) or "we withdrew it"
// (cancelled). Everything else a screen wants to say is a comparison on
// `progress` (see the predicates below), not a status of its own.
//
// Deriving presentation here is safe because presentation never authorizes:
// the `assert*` functions in server/helpers/staffingRequestRules.js stay the
// only authority on what a user may actually do.
const CLOSE_REASON_META = {
  fulfilled: { label: 'Fulfilled', tone: 'placed' },
  declined: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

export const getStaffingRequestStatusLabel = (request) => {
  if (request?.status !== 'closed') return 'Open';
  return CLOSE_REASON_META[request.reason]?.label ?? 'Closed';
};

export const getStaffingRequestStatusTone = (request) => {
  if (request?.status !== 'closed') return 'active';
  return CLOSE_REASON_META[request.reason]?.tone ?? 'muted';
};

// The facts an open request's row and detail read off `progress` instead of a
// status word. Kept as named predicates so the phrasing lives in one place.

// Filed against a `draftProject`, so no real project exists yet. Nobody can be
// suggested against it — `Recommendation.project` is a required reference — so
// this is a blocker, not a slow start.
export const isAwaitingProject = (request) => !request?.project;

export const hasNobodyPutForward = (request) => (request?.progress?.totals?.putForward ?? 0) === 0;

// Every position has at least as many placed as wanted. Nothing auto-closes,
// so an open request can sit here indefinitely waiting for an admin to close
// it as fulfilled.
export const isDemandMet = (request) => {
  const positions = request?.progress?.positions ?? [];
  if (positions.length === 0) return false;
  return positions.every((position) => position.placed >= position.wanted);
};

export const formatRequestedPositionsSummary = (requestedPositions = []) =>
  requestedPositions
    .map((requestedPosition) => `${requestedPosition.count} ${requestedPosition.position?.name}`)
    .join(', ');

// The filter tabs — the stored status, nothing more. A strict partition, so
// the counts sum to the total. Overdue is deliberately NOT a tab: it applies
// only to open requests but doesn't cover all of them, so it stays a red date
// on the row and a stat-strip number rather than a group.
export const REQUEST_GROUPS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open', tone: 'active' },
  { key: 'closed', label: 'Closed', tone: 'muted' },
];

export const getRequestGroup = (request) => (request?.status === 'closed' ? 'closed' : 'open');

export const countRequestsByGroup = (requests = []) => {
  const counts = { all: requests.length };
  for (const group of REQUEST_GROUPS) {
    if (group.key !== 'all') counts[group.key] = 0;
  }
  for (const request of requests) {
    counts[getRequestGroup(request)] += 1;
  }
  return counts;
};

// `progress` comes from the backend rules helper (deriveProgress) — read it,
// never recompute the counts themselves.
export const getRequestTotals = (request) =>
  request?.progress?.totals ?? { wanted: 0, putForward: 0, inSelection: 0, placed: 0 };

// deriveProgress keys its per-position rows by position id only, so pair each
// row back to the populated requestedPosition to get a name to show. Each row
// also carries the suggestions tagged to that position, so the UI can render a
// group per requested position — including the ones nobody was suggested for.
export const getPositionProgressRows = (request) => {
  const rows = request?.progress?.positions ?? [];
  const suggestions = request?.suggestions ?? [];
  return (request?.requestedPositions ?? []).map((requestedPosition) => {
    const positionId = requestedPosition.position?._id ?? requestedPosition.position;
    const row = rows.find((candidate) => String(candidate.position) === String(positionId));
    return {
      id: String(positionId),
      name: requestedPosition.position?.name ?? 'Unknown position',
      // What a candidate for this position gets judged against — carried on the
      // row so the picker doesn't have to be handed the requestedPosition too.
      technologies: (requestedPosition.technologies ?? [])
        .map((technology) => technology?.name)
        .filter(Boolean),
      wanted: row?.wanted ?? requestedPosition.count,
      putForward: row?.putForward ?? 0,
      inSelection: row?.inSelection ?? 0,
      placed: row?.placed ?? 0,
      suggestions: suggestions.filter(
        (suggestion) => String(suggestion.position) === String(positionId)
      ),
    };
  });
};

// What an edit is about to cost, read off the same `progress` and
// `suggestions` the detail pane renders. Mirrors the server's
// planStaffingRequestEdit: dropping a position (or changing it, which is the
// same event — there is no row identity) closes out whoever is still in
// selection for it, and a position with someone placed can't be dropped at all.
// The dialog needs those numbers before the write; the server refuses the same
// edits after it.
export const getEditImpact = (request, { positionIds = [], projectId } = {}) => {
  const keep = new Set(positionIds.map(String));
  const suggestions = request?.suggestions ?? [];
  const endingPositions = getPositionProgressRows(request).filter((row) => !keep.has(row.id));

  const blocked = endingPositions
    .filter((row) => row.placed > 0)
    .map((row) => ({
      name: row.name,
      internNames: row.suggestions
        .filter((suggestion) => suggestion.outcome === 'placed')
        .map((suggestion) => suggestion.internName),
    }));

  const currentProjectId = request?.project?._id ?? request?.project ?? null;
  const projectChanged = Boolean(projectId) && String(projectId) !== String(currentProjectId ?? '');

  return {
    endingPositions,
    blocked,
    closeOutCount: endingPositions.reduce((total, row) => total + row.inSelection, 0),
    projectChanged,
    // Placed recommendations move too — repointing a request only ever means
    // the wrong project was named, and that is exactly when the placed ones
    // most need to follow.
    movingCount: projectChanged ? suggestions.length : 0,
  };
};

// The positions of a request that can be neither changed nor removed, because
// someone is already placed against them (server: planStaffingRequestEdit).
// getEditImpact only reports the ones an edit is actually dropping — this is
// every one of them, so the form can lock those rows up front instead of
// letting the attempt fail on save.
export const getPlacedPositionLocks = (request) =>
  getPositionProgressRows(request)
    .filter((row) => row.placed > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      // `placed` is the count to show — it comes off `progress`, so it holds
      // even when a placed recommendation carries no readable intern name.
      placed: row.placed,
      internNames: row.suggestions
        .filter((suggestion) => suggestion.outcome === 'placed')
        .map((suggestion) => suggestion.internName),
    }));

// "Ana", "Ana and Ben" — the refusal reads as a sentence, so the names in it do
// too. Same wording as the server's, so the client-side stop and the 400 behind
// it never contradict each other.
export const describePlacedRefusal = (blocked = []) => {
  if (blocked.length === 0) return '';
  const { name, internNames } = blocked[0];
  const names =
    internNames.length <= 1
      ? internNames.join('')
      : `${internNames.slice(0, -1).join(', ')} and ${internNames[internNames.length - 1]}`;
  return `${name} can't be changed, ${names || 'someone'} ${
    internNames.length === 1 ? 'is' : 'are'
  } already placed against it`;
};

// "DP" for Dario Perić — first letter of the first and last word, so a
// three-part name doesn't produce three letters.
export const getInitials = (fullname = '') => {
  const words = fullname.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.map((word) => word[0].toUpperCase()).join('');
};

// A suggested intern's second line: what they work with, and how long they've
// been in the programme. There is no "duration" on an intern — `startDate` is
// the only time anchor on the profile, so months-since-start is what "5 mo"
// means here.
export const formatSuggestionMeta = (suggestion, now = new Date()) => {
  const parts = [...(suggestion.technologies ?? [])];
  if (suggestion.startDate) {
    const start = new Date(suggestion.startDate);
    const months = Math.max(
      0,
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    );
    parts.push(`${months} mo`);
  }
  return parts.join(' · ');
};

// Editing is gated on the request still being open (see the assertions in
// server/helpers/staffingRequestRules.js) — once closed, say so and say why.
export const getRequestLockLabel = (request) => {
  if (request?.status !== 'closed') return '';
  return CLOSE_REASON_META[request.reason]?.label ?? 'Closed';
};

// The one placed intern's name, but only where naming them beats counting them:
// at a single seat that is filled, "1 of 1 placed · Amina Delić" is the whole
// story of that position and there is no list to truncate. Above one seat it
// returns null and the caller counts instead.
//
// Shared because both sides of a requested position open their summary with it,
// and it is the kind of edge (wanted === 1) that gets fixed in one copy only.
export const getSolePlacedName = (row) => {
  const isFilled = row.placed >= row.wanted && row.wanted > 0;
  if (row.wanted !== 1 || !isFilled) return null;
  return row.suggestions.find((suggestion) => suggestion.outcome === 'placed')?.internName ?? null;
};
