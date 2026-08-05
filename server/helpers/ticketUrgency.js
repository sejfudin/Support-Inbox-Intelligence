/**
 * "What should I work on next" for one intern's open tickets.
 *
 * Pure and clock-injectable so the ordering can be unit-tested without a DB —
 * the intern dashboard's "start here" card is chosen entirely by this file, and
 * getting it wrong points someone at the wrong ticket every morning.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Weights are additive rather than a first-match-wins ladder, so a *critical*
// blocked ticket still outranks a *low* blocked one.
//
// `OVERDUE` has to clear the sum of everything else, not just the next weight
// down: the deadline and blocked terms stack, so the worst non-overdue ticket
// scores BLOCKED + DUE_SOON + critical = 400. 1000 leaves that unambiguous with
// room to add a term later. If you change any weight, re-check that sum — the
// suite pins it ("ranks overdue above every other combination").
const OVERDUE = 1000;
const BLOCKED = 200;
const DUE_SOON = 80;
const DUE_THIS_WEEK = 40;

const PRIORITY_WEIGHTS = Object.freeze({ critical: 120, high: 60, medium: 20, low: 0 });

// A deadline this close is worth flagging on the card; anything further out only
// nudges the ordering.
const DUE_SOON_DAYS = 2;
const DUE_THIS_WEEK_DAYS = 7;

// Whole days between two 'YYYY-MM-DD' keys. Anchored at noon UTC so a DST
// switch inside the range can't round the difference to the wrong day.
const daysBetween = (fromKey, toKey) =>
  Math.round(
    (new Date(`${toKey}T12:00:00Z`).getTime() - new Date(`${fromKey}T12:00:00Z`).getTime()) /
      MS_PER_DAY
  );

/**
 * Score one ticket.
 *
 * @param {{ priority?: string, dueDateKey?: string|null, isBlocked?: boolean }} ticket
 *   `dueDateKey` is an office-local 'YYYY-MM-DD' (or null) — the caller converts,
 *   so this file never has to know about timezones.
 * @param {string} todayKey office-local 'YYYY-MM-DD'
 * @returns {{ score: number, flags: string[], overdue: boolean }}
 *   `flags` drives the chips on the card, so it lists only what a person would
 *   call out: overdue, due soon, blocked, and a critical/high priority. The
 *   quieter weights (medium/low priority, due this week) move the ordering
 *   without adding a chip.
 */
const scoreTicketUrgency = (ticket, todayKey) => {
  const flags = [];
  let score = 0;

  const dueKey = ticket.dueDateKey || null;
  if (dueKey && dueKey < todayKey) {
    score += OVERDUE;
    flags.push('overdue');
  } else if (dueKey) {
    const daysOut = daysBetween(todayKey, dueKey);
    if (daysOut <= DUE_SOON_DAYS) {
      score += DUE_SOON;
      flags.push('due-soon');
    } else if (daysOut <= DUE_THIS_WEEK_DAYS) {
      score += DUE_THIS_WEEK;
    }
  }

  if (ticket.isBlocked) {
    score += BLOCKED;
    flags.push('blocked');
  }

  score += PRIORITY_WEIGHTS[ticket.priority] ?? 0;
  if (ticket.priority === 'critical' || ticket.priority === 'high') flags.push(ticket.priority);

  return { score, flags, overdue: flags.includes('overdue') };
};

/**
 * Comparator for already-scored tickets: most urgent first.
 *
 * Every tie-break is deterministic, so two refreshes a second apart can't
 * reshuffle the list under the reader — equal scores fall back to the nearer
 * deadline, dateless tickets last, then the oldest ticket number.
 */
const compareByUrgency = (a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  if (a.dueDateKey && b.dueDateKey) return a.dueDateKey < b.dueDateKey ? -1 : 1;
  if (a.dueDateKey) return -1;
  if (b.dueDateKey) return 1;
  return (a.taskNumber ?? Infinity) - (b.taskNumber ?? Infinity);
};

module.exports = { scoreTicketUrgency, compareByUrgency, PRIORITY_WEIGHTS };
