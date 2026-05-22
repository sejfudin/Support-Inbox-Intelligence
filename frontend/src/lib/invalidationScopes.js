import { invalidateAnalyticsQueries } from '@/lib/analyticsQueryCache';

export const invalidationScopes = {
  user: (userId) => `user:${String(userId)}`,
  workspace: (workspaceId) => `workspace:${String(workspaceId)}`,
  workspaceTickets: (workspaceId) => `workspace-tickets:${String(workspaceId)}`,
  ticket: (ticketId) => `ticket:${String(ticketId)}`,
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

export const invalidateWorkspaceScope = (queryClient, workspaceId) => {
  queryClient.invalidateQueries({ queryKey: ['tickets'] });
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
};

export const invalidateTicketScope = (queryClient, ticketId) => {
  queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
  queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
  queryClient.invalidateQueries({ queryKey: ['ticket-history', ticketId] });
  queryClient.invalidateQueries({ queryKey: ['ticket-description-images', ticketId] });
};

export const invalidateScope = (queryClient, scope) => {
  const parsed = parseScope(scope);
  if (!parsed) return false;

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

  return false;
};

export const invalidateScopes = (queryClient, scopes = []) => {
  const scopeList = Array.isArray(scopes) ? scopes : [scopes];
  scopeList.forEach((scope) => invalidateScope(queryClient, scope));
};
