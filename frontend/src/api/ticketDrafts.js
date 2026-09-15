import apiClient from './axios';

// The unsent New-ticket form, one per account per workspace. Self-only: no id
// travels in any of these — the server reads the account off the token. See
// `server/routes/ticketDrafts.js`.
export const getTicketDraft = async (workspaceId) => {
  const response = await apiClient.get('/ticket-drafts', { params: { workspaceId } });
  return response.data;
};

export const saveTicketDraft = async ({ draft, workspaceId }) => {
  const response = await apiClient.put('/ticket-drafts', { draft, workspaceId });
  return response.data;
};

export const deleteTicketDraft = async (workspaceId) => {
  const response = await apiClient.delete('/ticket-drafts', { params: { workspaceId } });
  return response.data;
};
