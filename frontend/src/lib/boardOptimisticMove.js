import { insertTicketIntoPages, removeTicketFromPages } from '@/helpers/boardCacheMove';
import { BOARD_COLUMN_QUERY_KEY } from '@/queries/boardTickets';

/**
 * The `columnStatusId` slot in a board column's query key. The key is
 * `[BOARD_COLUMN_QUERY_KEY, fetchMode, columnStatusId, workspaceId, search,
 * filterKey, pageSize]` — see `useBoardColumnTickets` in `queries/boardTickets.js`,
 * which is the one place that builds it. Reordering it there means changing this.
 */
const COLUMN_STATUS_ID_INDEX = 2;

const keyId = (queryKey) => JSON.stringify(queryKey);

/**
 * Moves a ticket between board columns in the query cache, ahead of the server.
 *
 * Deliberately thin: every page-array edit is delegated to `helpers/boardCacheMove.js`,
 * which is pure and tested. What lives here is only the cache traversal, which
 * this repo's test suite cannot exercise.
 *
 * Returns a snapshot — `[{ queryKey, data }]` for every entry it wrote — for
 * `rollbackOptimisticBoardMove` to replay on failure.
 */
export const applyOptimisticBoardMove = (
  queryClient,
  { ticketId, destinationStatusId, destinationStatusDoc }
) => {
  const snapshot = [];
  if (!ticketId || !destinationStatusId) return snapshot;

  const entries = queryClient.getQueryCache().findAll({ queryKey: [BOARD_COLUMN_QUERY_KEY] });
  const sourceKeys = [];
  let movedTicket = null;

  // Remove pass. Several column families can be live at once — `fetchMode` `all`
  // vs `my`, a different `search`, a different `sprintId` — and the card has to
  // leave the source column in each of them.
  entries.forEach((entry) => {
    const data = entry.state?.data;
    if (!data?.pages) return;
    // A column already keyed to the destination status is where the card is going,
    // not where it came from. Skipping it also keeps the two passes disjoint, so a
    // destination entry can never be snapshotted twice.
    if (String(entry.queryKey[COLUMN_STATUS_ID_INDEX]) === String(destinationStatusId)) return;

    const { pages, ticket } = removeTicketFromPages(data.pages, ticketId);
    if (!ticket) return;

    snapshot.push({ queryKey: entry.queryKey, data });
    queryClient.setQueryData(entry.queryKey, { ...data, pages });
    sourceKeys.push(entry.queryKey);
    movedTicket = ticket;
  });

  if (!movedTicket) return snapshot;

  // The status has to go in as the populated object the list endpoints send. A bare
  // id string would read as an empty slug and send the card to the first column —
  // see `resolveStatusDocFromColumnId` in `helpers/ticketStatus.js`.
  const optimisticTicket = {
    ...movedTicket,
    status: destinationStatusDoc ?? movedTicket.status,
  };

  // Insert pass. The destination key is derived from each source key by swapping
  // only the `columnStatusId` slot, rather than matching every cached column whose
  // status happens to be the destination. That is what keeps this correct across
  // filter variants: a ticket visible in a family's source column has already
  // passed that family's filters, so it belongs in that same family's destination
  // column — and nothing else can be concluded about the other families.
  const insertedKeys = new Set();

  sourceKeys.forEach((sourceKey) => {
    const destinationKey = [...sourceKey];
    destinationKey[COLUMN_STATUS_ID_INDEX] = destinationStatusId;
    if (insertedKeys.has(keyId(destinationKey))) return;

    // Not cached means the column never mounted, or is collapsed and never
    // fetched. Nothing to update — it fetches fresh when it mounts.
    const data = queryClient.getQueryData(destinationKey);
    if (!data?.pages) return;

    insertedKeys.add(keyId(destinationKey));
    snapshot.push({ queryKey: destinationKey, data });
    queryClient.setQueryData(destinationKey, {
      ...data,
      pages: insertTicketIntoPages(data.pages, optimisticTicket),
    });
  });

  return snapshot;
};

/** Puts every entry `applyOptimisticBoardMove` wrote back as it was. */
export const rollbackOptimisticBoardMove = (queryClient, snapshot = []) => {
  snapshot.forEach(({ queryKey, data }) => {
    queryClient.setQueryData(queryKey, data);
  });
};
