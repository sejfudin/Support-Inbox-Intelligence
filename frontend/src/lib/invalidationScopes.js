import { invalidateAnalyticsQueries } from '@/lib/analyticsQueryCache';
import { BOARD_COLUMN_QUERY_KEY } from '@/queries/boardTickets';
import { adminDashboardKeys } from '@/queries/adminDashboard';
import { internDashboardKeys } from '@/queries/internDashboard';
import { internProgressKeys } from '@/queries/internProgress';
import { STAFFING_REQUEST_NEWS_QUERY_KEY } from '@/queries/staffingRequests';
import { SPRINTS_QUERY_KEY } from '@/queries/sprints';

export const invalidationScopes = {
  user: (userId) => `user:${String(userId)}`,
  workspace: (workspaceId) => `workspace:${String(workspaceId)}`,
  workspaceTickets: (workspaceId) => `workspace-tickets:${String(workspaceId)}`,
  ticket: (ticketId) => `ticket:${String(ticketId)}`,
  intern: () => 'intern:all',
  workspaceDailies: (workspaceId) => `workspace-dailies:${String(workspaceId)}`,
  workspaceSprints: (workspaceId) => `workspace-sprints:${String(workspaceId)}`,
  staffingNews: () => 'staffing-news:all',
};

const parseScope = (scope) => {
  if (!scope || typeof scope !== 'string') return null;

  const separatorIndex = scope.indexOf(':');
  if (separatorIndex <= 0) return null;

  const type = scope.slice(0, separatorIndex);
  const id = scope.slice(separatorIndex + 1);

  if (!id) return null;
  return { type, id };
};

export const invalidateUserScope = (queryClient, userId) => {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: ['invitations', 'mine'] });
  queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  queryClient.invalidateQueries({ queryKey: ['workspaces', 'mine'] });

  if (userId) {
    queryClient.invalidateQueries({ queryKey: ['users', String(userId)] });
  }
};

/**
 * The two dashboard aggregates. Neither is keyed under a prefix any other scope
 * already invalidates, so they have to be named explicitly — an omission that
 * previously left the admin board's workload numbers frozen until a manual
 * refetch. Both roll up tickets, statuses and standups, so every scope that can
 * move one of those refreshes them.
 */
const invalidateDashboards = (queryClient) => {
  // Imported, never re-typed: a renamed key would otherwise silently stop matching
  // here and kill socket-driven refresh on that board, with no error and nothing in
  // the test suite to catch it. Prefix invalidation, so every workspace's board
  // under [...all, workspaceId] is covered.
  queryClient.invalidateQueries({ queryKey: adminDashboardKeys.all });
  queryClient.invalidateQueries({ queryKey: internDashboardKeys.all });
};

export const invalidateWorkspaceScope = (queryClient, workspaceId) => {
  queryClient.invalidateQueries({ queryKey: ['tickets'] });
  invalidateDashboards(queryClient);
  queryClient.invalidateQueries({ queryKey: ['workspaces', 'mine'] });
  queryClient.invalidateQueries({ queryKey: ['workspaces', 'admin-all'] });
  queryClient.invalidateQueries({ queryKey: ['ticket-statuses', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['categories', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['integration', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['repositories', workspaceId] });
  invalidateAnalyticsQueries(queryClient, workspaceId);

  if (workspaceId) {
    queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] });
  }
};

export const invalidateWorkspaceTicketsScope = (queryClient, workspaceId) => {
  queryClient.invalidateQueries({ queryKey: ['tickets'] });
  queryClient.invalidateQueries({ queryKey: [BOARD_COLUMN_QUERY_KEY] });
  // Both boards' workload numbers are open-ticket counts — per intern on the admin
  // board, for yourself on the intern one — so a ticket moving between statuses
  // changes them.
  invalidateDashboards(queryClient);
  // Every sprint number is an aggregation over its tickets — points done, tickets
  // needing attention — so a teammate moving a ticket between statuses, or into or
  // out of the sprint, changes what the sprint read returns. Sprint membership
  // emits no event of its own; it arrives on this scope, through the ticket-update
  // path, which is why the sprint queries have to be refreshed from here too.
  queryClient.invalidateQueries({ queryKey: [SPRINTS_QUERY_KEY] });
};

export const invalidateTicketScope = (queryClient, ticketId) => {
  queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
  queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
  queryClient.invalidateQueries({ queryKey: ['ticket-history', ticketId] });
  queryClient.invalidateQueries({ queryKey: ['ticket-description-images', ticketId] });
};

export const invalidateInternScope = (queryClient) => {
  // Prefix invalidation covers both the directory list (['interns', ...]) and
  // the leadership stats (['interns', 'stats']).
  queryClient.invalidateQueries({ queryKey: ['interns'] });
  // The intern board's pipeline and evaluations halves are programme data, not
  // workspace data, so no workspace scope reaches them. `emitInternDataChanged` on a
  // recommendation write is the only signal they get — without this, an intern
  // watching their own board keeps seeing the previous stage after an admin advances
  // it, until staleTime expires or the window refocuses.
  invalidateDashboards(queryClient);
  // "My progress" is the same programme data in full, and it is a page an intern
  // may well be sitting on when a mentor records an evaluation or sets a readiness
  // level — both of which now emit this scope. Imported key, same reason as above.
  queryClient.invalidateQueries({ queryKey: internProgressKeys.all });
  // The per-intern admin panels for the same data. Prefix keys, so one entry each
  // covers every intern's. Evaluations belong here as much as readiness does: the
  // scope now fires on an evaluation write too, and leaving this key out meant a
  // second admin's open `InternEvaluationsPanel` stayed stale while the readiness
  // panel beside it refreshed — the two writes behaving differently for no reason.
  queryClient.invalidateQueries({ queryKey: ['intern-evaluations'] });
  // Readiness levels also render on /my-technologies, off its own key.
  queryClient.invalidateQueries({ queryKey: ['intern-readiness'] });
  queryClient.invalidateQueries({ queryKey: ['intern-profile'] });
};

// Global, like `intern:all` — staffing requests aren't workspace-scoped, so
// one history write badges every connected admin/leadership client.
export const invalidateStaffingNewsScope = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: STAFFING_REQUEST_NEWS_QUERY_KEY });
};

export const invalidateWorkspaceDailiesScope = (queryClient, workspaceId) => {
  // Prefix invalidation covers every date under ['dailies', workspaceId, date].
  queryClient.invalidateQueries({ queryKey: ['dailies', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['dailies-history', workspaceId] });
  invalidateDashboards(queryClient);
};

// A teammate created, edited or deleted a sprint. The event carries no sprint
// body, so everything sprint-shaped refetches: prefix invalidation covers the
// list, the shown sprint (`[key, workspaceId, 'current']`) and any single sprint
// read under `[key, id]` at once. Deleting also detaches tickets, but that
// arrives as its own `workspace-tickets` scope on the same event rather than
// being assumed here.
export const invalidateWorkspaceSprintsScope = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: [SPRINTS_QUERY_KEY] });
};

export const invalidateScope = (queryClient, scope) => {
  const parsed = parseScope(scope);
  if (!parsed) return false;

  if (parsed.type === 'intern') {
    invalidateInternScope(queryClient);
    return true;
  }

  if (parsed.type === 'user') {
    invalidateUserScope(queryClient, parsed.id);
    return true;
  }

  if (parsed.type === 'workspace') {
    invalidateWorkspaceScope(queryClient, parsed.id);
    return true;
  }

  if (parsed.type === 'workspace-tickets') {
    invalidateWorkspaceTicketsScope(queryClient, parsed.id);
    return true;
  }

  if (parsed.type === 'ticket') {
    invalidateTicketScope(queryClient, parsed.id);
    return true;
  }

  if (parsed.type === 'workspace-dailies') {
    invalidateWorkspaceDailiesScope(queryClient, parsed.id);
    return true;
  }

  if (parsed.type === 'workspace-sprints') {
    invalidateWorkspaceSprintsScope(queryClient, parsed.id);
    return true;
  }

  if (parsed.type === 'staffing-news') {
    invalidateStaffingNewsScope(queryClient);
    return true;
  }

  return false;
};

export const invalidateScopes = (queryClient, scopes = []) => {
  const scopeList = Array.isArray(scopes) ? scopes : [scopes];
  scopeList.forEach((scope) => invalidateScope(queryClient, scope));
};
