import { PRIORITY_RANK } from '@/helpers/ticketPriority';

/**
 * How the board orders the cards *inside* every column. Separate from
 * `sortBoardTasksByPriorityOrder` in `boardTicketsQuery.js`: that one implements
 * the priority filter's asc/desc toggle and only knows about priority, while this
 * is the board-wide sort control from the UI overhaul (Priority / Points / Due /
 * Newest) and applies to whatever the column already fetched.
 */
export const BOARD_SORT_OPTIONS = [
  { value: 'priority', label: 'Priority' },
  { value: 'points', label: 'Points' },
  { value: 'due', label: 'Due date' },
  { value: 'newest', label: 'Newest' },
];

export const DEFAULT_BOARD_SORT = 'priority';

export const BOARD_SORT_STORAGE_KEY = 'board-card-sort';

export const isValidBoardSort = (value) =>
  BOARD_SORT_OPTIONS.some((option) => option.value === value);

const time = (value) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

// A card with nothing to sort on always sinks, whichever key is active: an
// undated ticket among dated ones says "not scheduled", and floating it to the
// top of a due-date sort would read as "due first".
const nullsLast = (a, b, direction) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * direction;
};

const COMPARATORS = {
  priority: (a, b) =>
    (PRIORITY_RANK[String(b.priority || '').toLowerCase()] ?? 0) -
    (PRIORITY_RANK[String(a.priority || '').toLowerCase()] ?? 0),
  points: (a, b) => nullsLast(a.storyPoints ?? null, b.storyPoints ?? null, -1),
  due: (a, b) => nullsLast(time(a.dueDate), time(b.dueDate), 1),
  newest: (a, b) => nullsLast(time(a.createdAt), time(b.createdAt), -1),
};

export function sortBoardCards(tasks, sortKey) {
  const comparator = COMPARATORS[sortKey];
  if (!comparator) return tasks;

  // Ties fall back to the newest card so the order is stable and predictable
  // rather than "whatever the API paged in first".
  return [...tasks].sort((a, b) => comparator(a, b) || COMPARATORS.newest(a, b));
}
