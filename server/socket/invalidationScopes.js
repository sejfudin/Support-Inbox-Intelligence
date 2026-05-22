const invalidationScopes = {
  user: (userId) => `user:${String(userId)}`,
  workspace: (workspaceId) => `workspace:${String(workspaceId)}`,
  workspaceTickets: (workspaceId) => `workspace-tickets:${String(workspaceId)}`,
  ticket: (ticketId) => `ticket:${String(ticketId)}`,
};

module.exports = {
  invalidationScopes,
};
