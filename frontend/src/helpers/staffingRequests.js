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
  request?.progress?.totals ?? { wanted: 0, putForward: 0, placed: 0 };

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
      wanted: row?.wanted ?? requestedPosition.count,
      putForward: row?.putForward ?? 0,
      placed: row?.placed ?? 0,
      suggestions: suggestions.filter(
        (suggestion) => String(suggestion.position) === String(positionId)
      ),
    };
  });
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

export const getRequestSkills = (request) => {
  const names = (request?.requestedPositions ?? []).flatMap((requestedPosition) =>
    (requestedPosition.technologies ?? []).map((technology) => technology?.name).filter(Boolean)
  );
  return [...new Set(names)];
};

// Editing is gated on the request still being open (see the assertions in
// server/helpers/staffingRequestRules.js) — once closed, say so and say why.
export const getRequestLockLabel = (request) => {
  if (request?.status !== 'closed') return '';
  return CLOSE_REASON_META[request.reason]?.label ?? 'Closed';
};
