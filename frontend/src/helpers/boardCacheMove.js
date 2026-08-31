/**
 * Page-array arithmetic for moving a ticket between two board columns' caches.
 *
 * Each board column is its own `useInfiniteQuery` (`queries/boardTickets.js`), so
 * an optimistic drag is a removal from one column's `data.pages` and an insertion
 * into another's. All of that arithmetic lives here, as pure functions over the
 * `pages` array, because it is the part this repo's test suite can actually cover
 * — the `queryClient` orchestration on top of it (`lib/boardOptimisticMove.js`)
 * cannot be unit tested here. Keep logic in this file, not in that one.
 */

const getTicketId = (ticket) => ticket?._id ?? ticket?.id ?? ticket?.ticketId ?? ticket?.uuid;

const sameTicket = (ticket, ticketId) => String(getTicketId(ticket)) === String(ticketId);

/**
 * `pagination.total` is the count for the whole query, repeated identically on
 * every page the server returned — and the column's count label reads it off
 * page 1 only (`BoardPage.jsx`, `data.pages[0].pagination.total`). So a move has
 * to shift it on *every* cached page, not just the page the card sat on:
 * decrementing page 2 alone would leave the label showing the old number, which
 * is exactly the mismatch a person notices during a drag.
 *
 * A page with no `pagination` is left without one rather than given a made-up
 * object — the label already falls back to the rendered card count in that case.
 */
const shiftPageTotal = (page, delta) => {
  if (typeof page?.pagination?.total !== 'number') return page;
  return {
    ...page,
    pagination: { ...page.pagination, total: Math.max(0, page.pagination.total + delta) },
  };
};

/**
 * Drops `ticketId` out of the source column's pages.
 *
 * Returns the trimmed pages plus the ticket document that was removed — the
 * caller needs that document to insert into the destination column, since it is
 * the only copy of the card's full payload it has. When the ticket is not in
 * these pages (a column that never mounted, a different filter family, a stale
 * key) nothing is touched and `ticket` is `null`, which is the caller's signal to
 * skip this cache entry entirely.
 */
export const removeTicketFromPages = (pages, ticketId) => {
  if (!Array.isArray(pages) || pages.length === 0 || !ticketId) {
    return { pages, ticket: null };
  }

  let removed = null;

  const nextPages = pages.map((page) => {
    const tickets = Array.isArray(page?.data) ? page.data : null;
    if (!tickets || removed) return page;

    const index = tickets.findIndex((ticket) => sameTicket(ticket, ticketId));
    if (index === -1) return page;

    removed = tickets[index];
    return {
      ...page,
      data: tickets.filter((_, ticketIndex) => ticketIndex !== index),
    };
  });

  if (!removed) return { pages, ticket: null };

  return { pages: nextPages.map((page) => shiftPageTotal(page, -1)), ticket: removed };
};

/**
 * Adds `ticket` to the destination column's pages.
 *
 * Position does not matter: the board sorts every column client-side
 * (`sortBoardCards` / `sortBoardTasksByPriorityOrder` in `BoardPage.jsx`), so the
 * card lands where the active sort puts it regardless of where it goes in the
 * array. Page 1 is chosen because it is the page that always exists.
 *
 * Already-present is treated as a no-op so a repeated or overlapping optimistic
 * write cannot draw the same card twice.
 */
export const insertTicketIntoPages = (pages, ticket) => {
  const ticketId = getTicketId(ticket);
  if (!Array.isArray(pages) || pages.length === 0 || !ticketId) return pages;

  const alreadyPresent = pages.some((page) =>
    (Array.isArray(page?.data) ? page.data : []).some((entry) => sameTicket(entry, ticketId))
  );
  if (alreadyPresent) return pages;

  return pages.map((page, pageIndex) => {
    const withTotal = shiftPageTotal(page, 1);
    if (pageIndex !== 0) return withTotal;

    const tickets = Array.isArray(page?.data) ? page.data : [];
    return { ...withTotal, data: [ticket, ...tickets] };
  });
};
