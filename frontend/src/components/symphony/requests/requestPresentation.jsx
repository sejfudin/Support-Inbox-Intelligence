import { format, differenceInCalendarDays, isValid } from 'date-fns';
import { AlertTriangle, CheckCircle2, Clock, FolderPlus } from 'lucide-react';
import { hasNobodyPutForward, isAwaitingProject, isDemandMet } from '@/helpers/staffingRequests';

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

export const getRequestSubtitle = (request) => {
  if (request?.project?.name) return request.project.client ?? '';
  return request?.draftProject?.description ?? '';
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
 * The one thing this request most needs someone to notice, or null. Derived
 * from the counts — deliberately NOT a status, so it renders as a banner rather
 * than as another pill competing with open/closed.
 *
 * Ordered by who is blocked: a missing project blocks everyone, demand met
 * blocks an admin from closing, overdue and nobody-suggested are the slow
 * cases. Only the first applicable one shows; a stack of banners is noise.
 */
export const getRequestBlocker = (request, today = new Date()) => {
  if (!request || request.status === 'closed') return null;

  if (isAwaitingProject(request)) {
    return {
      tone: 'warning',
      Icon: FolderPlus,
      text: 'This request names a project that does not exist yet. Nobody can be put forward until it is created and linked.',
    };
  }

  if (isDemandMet(request)) {
    return {
      tone: 'success',
      Icon: CheckCircle2,
      text: 'Every seat is placed. Nothing closes a request automatically — an admin still needs to close it as fulfilled.',
    };
  }

  const neededBy = getNeededBy(request, today);
  if (neededBy.overdue) {
    return {
      tone: 'warning',
      Icon: AlertTriangle,
      text: `The needed-by date passed ${neededBy.sub?.replace(' overdue', '')} ago and the seats are not filled.`,
    };
  }

  if (hasNobodyPutForward(request)) {
    return {
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
