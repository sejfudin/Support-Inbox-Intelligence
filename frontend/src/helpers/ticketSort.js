/**
 * Maps a TanStack Table sorting state onto the query parameters the tickets API
 * understands.
 *
 * Every ticket list is paginated, so the sort has to be the server's: ordering
 * the 25 rows a page happens to hold is not a sort, it just looks like one until
 * you press Next. Anything the API cannot order is therefore not offered as a
 * sortable header.
 */

/** Table column id -> the API's `sortBy` value. */
export const TICKET_SORT_FIELD_BY_COLUMN = {
  taskNumber: 'taskNumber',
  title: 'subject',
  storyPoints: 'storyPoints',
  dueDate: 'dueDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  archivedAt: 'archivedAt',
};

/**
 * Priority is the exception: low < medium < high < critical is an order, not an
 * alphabet, so the API ranks it through its own `priorityOrder` parameter and
 * ignores `sortBy` while that is set.
 */
export const TICKET_PRIORITY_SORT_COLUMN = 'priority';

export const isSortableTicketColumn = (columnId) =>
  columnId === TICKET_PRIORITY_SORT_COLUMN || Boolean(TICKET_SORT_FIELD_BY_COLUMN[columnId]);

/**
 * Reduces a sorting state to the single sortable column the API can honour,
 * falling back to the page's default when nothing usable is left — a paginated
 * list with no order at all pages inconsistently.
 */
export const normalizeTicketSorting = (sorting, fallback = []) => {
  const entries = Array.isArray(sorting) ? sorting : [];
  const active = entries.find((entry) => entry && isSortableTicketColumn(entry.id));

  if (!active) {
    const fallbackEntries = Array.isArray(fallback) ? fallback : [];
    const fallbackActive = fallbackEntries.find(
      (entry) => entry && isSortableTicketColumn(entry.id)
    );
    return fallbackActive ? [{ id: fallbackActive.id, desc: Boolean(fallbackActive.desc) }] : [];
  }

  return [{ id: active.id, desc: Boolean(active.desc) }];
};

/** `{}` when there is no sort — the caller's existing defaults then apply. */
export const buildTicketSortParams = (sorting) => {
  const [active] = normalizeTicketSorting(sorting);
  if (!active) return {};

  const direction = active.desc ? 'desc' : 'asc';

  if (active.id === TICKET_PRIORITY_SORT_COLUMN) {
    return { priorityOrder: direction };
  }

  return { sortBy: TICKET_SORT_FIELD_BY_COLUMN[active.id], sortOrder: direction };
};

/** Archive answers "what did we archive recently" before anything else. */
export const ARCHIVE_DEFAULT_SORT = [{ id: 'archivedAt', desc: true }];

/** Backlog is a triage queue: newest first. */
export const BACKLOG_DEFAULT_SORT = [{ id: 'createdAt', desc: true }];
