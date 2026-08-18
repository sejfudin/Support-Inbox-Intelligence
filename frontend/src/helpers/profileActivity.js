import { differenceInCalendarDays, format } from 'date-fns';
import { dayStatusLabel, formatRequestDates } from '@/helpers/attendance';

/**
 * The profile page's "Recent activity" feed.
 *
 * There is no activity endpoint, and this deliberately does not invent one: every
 * row here is something the client already fetches for its own sake — the
 * caller's tickets, their attendance records, their absence requests. What the
 * helper adds is the merge: one list, newest first, inside a fixed window.
 *
 * Anything that cannot be dated is dropped rather than guessed at. A remote day
 * written by an approval has no `checkedInAt`, so it is not a check-in and does
 * not appear as one — the approval itself already shows up as its own row.
 */
export const ACTIVITY_WINDOW_DAYS = 7;
export const ACTIVITY_LIMIT = 6;

/** Row accents, matching the status tones used across the app. */
export const ACTIVITY_TONE = Object.freeze({
  SUCCESS: 'success',
  INFO: 'info',
  WARNING: 'warning',
  NEUTRAL: 'neutral',
});

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `#81 Subject`, or just the subject on a workspace that never numbered its tickets. */
const ticketLabel = (ticket) => {
  const subject = ticket.subject || 'Untitled ticket';
  return ticket.taskNumber ? `#${ticket.taskNumber} ${subject}` : subject;
};

const ticketRows = (tickets) =>
  tickets.flatMap((ticket) => {
    if (!ticket) return [];

    // `doneAt` is the only timestamp that means "finished"; `updatedAt` moves on
    // any edit, so a ticket sitting in Done reads as "Closed" from the moment it
    // got there and never re-announces itself when someone fixes a typo on it.
    const closedAt = ticket.status?.isDone ? toDate(ticket.doneAt) : null;
    const at = closedAt || toDate(ticket.updatedAt);
    if (!at) return [];

    return [
      {
        id: `ticket-${ticket._id || ticket.id}`,
        tone: closedAt ? ACTIVITY_TONE.SUCCESS : ACTIVITY_TONE.INFO,
        title: `${closedAt ? 'Closed' : 'Updated'} ${ticketLabel(ticket)}`,
        at,
      },
    ];
  });

const checkInRows = (records, hubName) =>
  records.flatMap((record) => {
    const at = toDate(record?.checkedInAt);
    if (!at) return [];

    return [
      {
        id: `check-in-${record.date}`,
        tone: ACTIVITY_TONE.INFO,
        title: hubName ? `Checked in at the ${hubName} hub` : 'Checked in for the day',
        at,
      },
    ];
  });

const REQUEST_VERDICT = {
  approved: { verb: 'approved', tone: ACTIVITY_TONE.SUCCESS },
  rejected: { verb: 'declined', tone: ACTIVITY_TONE.WARNING },
  revoked: { verb: 'revoked', tone: ACTIVITY_TONE.WARNING },
};

const requestRows = (requests) =>
  requests.flatMap((request) => {
    if (!request) return [];

    const verdict = REQUEST_VERDICT[request.status];
    // A decided request is dated by the decision; anything still open (or since
    // withdrawn, which the API does not timestamp) is dated by the ask.
    const at = toDate(verdict ? request.decidedAt : request.createdAt);
    if (!at) return [];

    const kind = dayStatusLabel(request.type);
    const days = formatRequestDates(request.dates);

    return [
      {
        id: `request-${request.id}`,
        tone: verdict ? verdict.tone : ACTIVITY_TONE.NEUTRAL,
        title: `${kind} request ${verdict ? verdict.verb : 'sent'} — ${days}`,
        at,
      },
    ];
  });

/**
 * Merge every source into one feed.
 *
 * @param {object} sources
 * @param {Array} [sources.tickets] - the caller's tickets, as `/tickets/my-tickets` returns them
 * @param {Array} [sources.records] - attendance records `{ date, checkedInAt }`
 * @param {Array} [sources.requests] - the caller's absence requests
 * @param {string} [sources.hubName] - names the hub in a check-in row
 * @param {Date} [sources.now] - injected so the window is testable
 * @returns {Array<{ id: string, tone: string, title: string, at: Date }>} newest first
 */
export const buildProfileActivity = ({
  tickets = [],
  records = [],
  requests = [],
  hubName = '',
  now = new Date(),
  windowDays = ACTIVITY_WINDOW_DAYS,
  limit = ACTIVITY_LIMIT,
} = {}) => {
  const since = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  return [...ticketRows(tickets), ...checkInRows(records, hubName), ...requestRows(requests)]
    .filter((row) => row.at.getTime() >= since && row.at.getTime() <= now.getTime())
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
};

/**
 * The right-hand timestamp on an activity row.
 *
 * Inside the feed's own window a weekday and a clock time are all the reader
 * needs — "Wed 16:41" places the event without them counting back from a date.
 * Today and yesterday get named because those two are what the eye looks for
 * first, and the date is only spelled out once the day name stops being unique.
 */
export const formatActivityTime = (date, now = new Date()) => {
  const at = toDate(date);
  if (!at) return '';

  const days = differenceInCalendarDays(now, at);
  const time = format(at, 'HH:mm');

  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days < 7) return `${format(at, 'EEE')} ${time}`;
  return `${format(at, 'd MMM')} ${time}`;
};
