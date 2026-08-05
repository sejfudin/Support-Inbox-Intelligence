/**
 * Where a workload segment points: this intern's tickets, narrowed to one status.
 *
 * Both halves of the workload card (the donut and the bar) and their shared legend
 * link through here so a click means the same thing wherever it lands.
 *
 * `assignee=me` is the alias `TicketPage` resolves against the signed-in user, so
 * the URL never carries a raw user id. `tab` is the status, encoded the way
 * `TicketPage.encodeTabParam` expects — spaces become underscores, since the slugs
 * are space-separated (`'in progress'`).
 */
export const ticketsPathForStatus = (slug) =>
  `/tickets?assignee=me&tab=${encodeURIComponent(String(slug).replace(/\s+/g, '_'))}`;
