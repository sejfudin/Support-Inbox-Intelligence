import { format, differenceInCalendarDays, isValid } from 'date-fns';
import { AlertTriangle, CheckCircle2, Clock, FolderPlus, UserRoundX } from 'lucide-react';
import { hasNobodyPutForward, isAwaitingProject, isDemandMet } from '@/helpers/staffingRequests';
import { isActivePipelineRecommendation } from '@/helpers/recommendations';

// Both requests pages lay the master list and the detail pane out as a `lg:`
// two-column grid, so below that width only one of them is on screen. Kept
// here rather than in either page because the two must agree: a page whose
// query and grid disagree either strands the back button or blanks the pane.
export const SINGLE_PANE_QUERY = '(max-width: 1023.98px)';

// `client` is optional on a draft project and `project` may be absent
// altogether, so the title has to survive every combination rather than
// producing an orphaned em dash.
export const getRequestTitle = (request) => {
  const project = request?.project;
  if (project?.name) return project.name;
  const draft = request?.draftProject;
  if (!draft?.name) return 'Untitled request';
  return draft.client ? `${draft.client} — ${draft.name}` : draft.name;
};

export const formatDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? format(date, 'd MMM') : null;
};

/**
 * `neededBy` is optional, so every consumer has to handle three cases, not two:
 * a date in the future, a date already gone, and no date at all. Overdue only
 * means anything while the request is open — a closed request's date is history.
 */
export const getNeededBy = (request, today = new Date()) => {
  if (!request?.neededBy) {
    return { text: 'No date given', overdue: false, missing: true, sub: null };
  }
  const date = new Date(request.neededBy);
  if (!isValid(date)) {
    return { text: 'No date given', overdue: false, missing: true, sub: null };
  }

  const days = differenceInCalendarDays(date, today);
  const isOpen = request.status !== 'closed';
  const overdue = isOpen && days < 0;

  let sub = null;
  if (isOpen) {
    if (days < 0) sub = `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} overdue`;
    else if (days === 0) sub = 'today';
    else if (days < 14) sub = `${days} ${days === 1 ? 'day' : 'days'} left`;
    else sub = `${Math.round(days / 7)} weeks left`;
  }

  return {
    text: format(date, 'd MMM yyyy'),
    short: format(date, 'd MMM'),
    overdue,
    missing: false,
    sub,
  };
};

/**
 * Interns still mid-pipeline (recommended / interviewing) on a request — the
 * ones a close would close out. On an open request this is the number the close
 * dialog has to name before anyone confirms; on a closed one it should be zero,
 * because closing resolved them.
 */
export const getLeftoverSuggestions = (request) =>
  (request?.suggestions ?? []).filter(isActivePipelineRecommendation);

/**
 * The candidates a close would actually close out — the leftovers, narrowed to
 * the positions the request still asks for.
 *
 * That narrowing is not cosmetic: it mirrors `selectCloseOutRecommendations` on
 * the server, and without it the close dialog can promise to close out an intern
 * the cascade will leave alone, and demand a reason the server doesn't want.
 */
export const getCloseOutSuggestions = (request) => {
  const requested = new Set(
    (request?.requestedPositions ?? []).map((requestedPosition) =>
      String(requestedPosition.position?._id ?? requestedPosition.position)
    )
  );
  return getLeftoverSuggestions(request).filter((suggestion) =>
    requested.has(String(suggestion.position))
  );
};

/**
 * The one thing this request most needs someone to notice, or null. Derived
 * from the counts — deliberately NOT a status, so it renders as a banner rather
 * than as another pill competing with open/closed.
 *
 * Ordered by who is blocked: a missing project blocks everyone, demand met
 * blocks an admin from closing, overdue and nobody-suggested are the slow
 * cases. Only the first applicable one shows; a stack of banners is noise.
 */
export const getRequestBlocker = (request, today = new Date()) => {
  if (!request) return null;

  // A closed request has exactly one thing left worth saying, and it is not
  // about the request: anyone still open on it. Closing closes out every
  // candidate in selection for a position the request asked for, so this should
  // be empty — a leftover means a recommendation tagged here for a position the
  // request no longer lists, which the cascade deliberately does not touch.
  // Everything else below is about filling seats, which a closed request is no
  // longer trying to do.
  if (request.status === 'closed') {
    const leftover = getLeftoverSuggestions(request);
    if (leftover.length === 0) return null;
    return {
      key: 'leftover',
      tone: 'warning',
      Icon: UserRoundX,
      text:
        leftover.length === 1
          ? 'One intern is still open on this closed request, for a position it no longer asks for — so closing it resolved nothing for them. They need placing, marking not placed, or reassigning to another request.'
          : `${leftover.length} interns are still open on this closed request, for positions it no longer asks for — so closing it resolved nothing for them. They need placing, marking not placed, or reassigning to another request.`,
    };
  }

  if (isAwaitingProject(request)) {
    return {
      key: 'needs-project',
      tone: 'warning',
      Icon: FolderPlus,
      text: 'Needs project — this request names a project that does not exist yet. Nobody can be put forward until an admin links or creates one.',
    };
  }

  if (isDemandMet(request)) {
    return {
      key: 'demand-met',
      tone: 'success',
      Icon: CheckCircle2,
      text: 'Every seat is placed. Nothing closes a request automatically — an admin still needs to close it as fulfilled.',
    };
  }

  const neededBy = getNeededBy(request, today);
  if (neededBy.overdue) {
    return {
      key: 'overdue',
      tone: 'warning',
      Icon: AlertTriangle,
      text: `The needed-by date passed ${neededBy.sub?.replace(' overdue', '')} ago and the seats are not filled.`,
    };
  }

  if (hasNobodyPutForward(request)) {
    return {
      key: 'nobody-put-forward',
      tone: 'info',
      Icon: Clock,
      text: 'Nobody has been put forward yet. Waiting on an admin to suggest candidates.',
    };
  }

  return null;
};

// A recommendation's own state, shown on the suggestion card. `outcome` wins
// when it is set: it is the resolution, `status` is only where it got to.
export const getSuggestionState = (suggestion) => {
  if (suggestion?.outcome === 'placed') return { label: 'placed', tone: 'placed' };
  if (suggestion?.outcome === 'not_placed') return { label: 'not placed', tone: 'muted' };
  return { label: suggestion?.status?.replace(/_/g, ' ') ?? 'suggested', tone: 'active' };
};
