// The workload segments both dashboards render, and the one resolver that turns
// them into a workspace's own statuses.
//
// Shared rather than copied: the admin board and the intern board show the same
// four segments for the same reason, and they used to each carry their own copy
// of the list plus a near-identical resolver. Adding a fifth segment meant
// editing two services and hoping neither drifted.

const statusService = require('../services/statusService');

// The workload segments, in render order. Fixed rather than derived from the
// workspace's status list so every board has the same shape — a workspace that
// renamed or removed one still renders four segments. Labels and colors come
// from the workspace's own TicketStatus rows when they exist and fall back to
// the platform defaults. `done` and `backlog` are deliberately excluded: this is
// open work in flight.
//
// **Matching is by slug, and that is load-bearing.** A slug is a status's stable
// identity, which is why `statusService.updateStatus` changes the label only and
// leaves the slug alone. It used to regenerate the slug on every rename, and this
// resolver then silently under-reported: renaming "To do" matched no entry below,
// the segment fell back to the *default* label with a `null` statusId, dropped out
// of the id→slug map, and its tickets were never counted — a phantom "To do"
// column reading 0 while the real work sat under the new name. The fallback covers
// a *removed* status; it never made a *renamed* one read correctly. If slug
// regeneration is ever reintroduced, both dashboards under-report again.
const WORKLOAD_SLUGS = ['to do', 'in progress', 'on staging', 'blocked'];

// Segment colour when a workspace has neither its own row for a slug nor a
// platform default to fall back on.
const FALLBACK_COLOR = '#64748b';

/**
 * Resolves a workspace's four workload segments, from a single status query.
 *
 * Returns more than any one caller needs, deliberately — the alternative is two
 * resolvers over the same query that drift apart, which is what this replaces:
 *
 * - `buckets` — the display list, canonical order: `{ slug, label, color, statusId }`.
 * - `statusIdToSlug` — bucket status id → slug, for aggregations that group by
 *   status id and are read back by slug.
 * - `byId` — *every* status the workspace has, by id. The intern board renders a
 *   badge for whichever status a ticket is actually in, including ones outside
 *   the four segments.
 * - `openStatusIds` — everything neither done nor backlog, derived from the
 *   workspace's own flags rather than from `WORKLOAD_SLUGS`. A ticket sitting in
 *   a custom status the workspace added still counts as open and is never
 *   silently dropped from "my tickets".
 */
const resolveWorkloadBuckets = async (workspaceId) => {
  const statuses = await statusService.getWorkspaceStatuses(workspaceId);
  const bySlug = new Map(statuses.map((status) => [status.slug, status]));
  const defaultsBySlug = new Map(statusService.DEFAULT_STATUSES.map((s) => [s.slug, s]));

  const buckets = WORKLOAD_SLUGS.map((slug) => {
    const status = bySlug.get(slug);
    const fallback = defaultsBySlug.get(slug);
    return {
      slug,
      label: status?.label || fallback?.label || slug,
      color: status?.color || fallback?.color || FALLBACK_COLOR,
      statusId: status?._id || null,
    };
  });

  const statusIdToSlug = new Map(
    buckets.filter((b) => b.statusId).map((b) => [String(b.statusId), b.slug])
  );

  const byId = new Map(statuses.map((status) => [String(status._id), status]));

  const openStatusIds = statuses
    .filter((status) => !status.isDone && !status.isBacklog)
    .map((status) => status._id);

  return { buckets, statusIdToSlug, byId, openStatusIds };
};

module.exports = { WORKLOAD_SLUGS, resolveWorkloadBuckets };
