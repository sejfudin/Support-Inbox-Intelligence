const invalidationScopes = {
  user: (userId) => `user:${String(userId)}`,
  workspace: (workspaceId) => `workspace:${String(workspaceId)}`,
  workspaceTickets: (workspaceId) => `workspace-tickets:${String(workspaceId)}`,
  ticket: (ticketId) => `ticket:${String(ticketId)}`,
  workspaceDailies: (workspaceId) => `workspace-dailies:${String(workspaceId)}`,
  // Sprints are workspace-scoped, so this scope is only ever emitted into that
  // workspace's room — a sprint is never visible to another tenant.
  workspaceSprints: (workspaceId) => `workspace-sprints:${String(workspaceId)}`,
  // FEP interns/recommendations are a global (non-workspace) module, so this
  // scope carries a fixed id and every subscribed client invalidates its
  // ['interns'] queries (directory + leadership stats).
  intern: () => 'intern:all',
  // Staffing requests are also global (not workspace-scoped) — every
  // history event on one fans out to every connected client, and the
  // leadership/admin news badge is the only consumer.
  staffingNews: () => 'staffing-news:all',
};

module.exports = {
  invalidationScopes,
};
