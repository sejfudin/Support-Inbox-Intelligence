const invalidationScopes = {
  user: (userId) => `user:${String(userId)}`,
  workspace: (workspaceId) => `workspace:${String(workspaceId)}`,
  ticket: (ticketId) => `ticket:${String(ticketId)}`,
};

module.exports = {
  invalidationScopes,
};
