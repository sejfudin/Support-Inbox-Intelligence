import apiClient from './axios';

export const getAllTickets = async ({
  page,
  limit,
  search,
  status,
  statusId,
  priority,
  priorities,
  assigneeIds,
  priorityOrder,
  archived,
  workspaceId,
  sortBy,
  sortOrder,
  periodDays,
  awaitingReviewFrom,
  reviewRequestState,
  sprintId,
  unsprinted,
} = {}) => {
  const response = await apiClient.get('/tickets', {
    params: {
      page,
      limit,
      search,
      status,
      statusId,
      priority,
      priorities,
      assigneeIds,
      priorityOrder,
      archived,
      workspaceId,
      sortBy,
      sortOrder,
      periodDays,
      awaitingReviewFrom,
      reviewRequestState,
      sprintId,
      unsprinted,
    },
  });
  return response.data;
};

export const getTicket = async (id) => {
  const response = await apiClient.get(`/tickets/${id}`);
  return response.data;
};

export const addMessage = async ({ ticketId, text }) => {
  const response = await apiClient.post(`/tickets/${ticketId}/messages`, {
    text,
  });
  return response.data;
};

export const createTicket = async (ticketData) => {
  const response = await apiClient.post('/tickets', ticketData);
  return response.data;
};

export const updateTicket = async (ticketId, updates) => {
  const response = await apiClient.patch(`/tickets/${ticketId}`, updates);
  return response.data;
};

// One request for the whole planning-modal selection: `sprint` set moves every
// ticket into it, `null` clears it. See `server/controllers/tickets.js`.
export const setSprintMembership = async ({ ticketIds, sprint, workspaceId }) => {
  const response = await apiClient.patch('/tickets/sprint-membership', {
    ticketIds,
    sprint,
    workspaceId,
  });
  return response.data;
};

export const archiveTicket = async (ticketId) => {
  const response = await apiClient.patch(`/tickets/${ticketId}/archive`);
  return response.data;
};

export const unarchiveTicket = async (ticketId) => {
  const response = await apiClient.patch(`/tickets/${ticketId}/unarchive`);
  return response.data;
};

export const getReviewerCandidates = async (ticketId) => {
  const response = await apiClient.get(`/tickets/${ticketId}/review-request/candidates`);
  return response.data;
};

export const requestReview = async (ticketId, { prUrl, reviewerId }) => {
  const response = await apiClient.post(`/tickets/${ticketId}/review-request`, {
    prUrl,
    reviewerId,
  });
  return response.data;
};

export const answerReview = async (ticketId, { state }) => {
  const response = await apiClient.patch(`/tickets/${ticketId}/review-request`, { state });
  return response.data;
};

export const cancelReview = async (ticketId) => {
  const response = await apiClient.delete(`/tickets/${ticketId}/review-request`);
  return response.data;
};

export const getMyTickets = async ({
  page,
  limit,
  search,
  status,
  statusId,
  priority,
  priorities,
  priorityOrder,
  sortBy,
  sortOrder,
  workspaceId,
} = {}) => {
  const response = await apiClient.get('/tickets/my-tickets', {
    params: {
      page,
      limit,
      search,
      status,
      statusId,
      priority,
      priorities,
      priorityOrder,
      sortBy,
      sortOrder,
      workspaceId,
    },
  });
  return response.data;
};

export const suggestTicketMetadata = async ({ subject, description }) => {
  const response = await apiClient.post('/tickets/suggest-metadata', {
    subject,
    description,
  });
  return response.data;
};

export const generateTicketDescription = async ({ subject, prompt }) => {
  const response = await apiClient.post('/tickets/generate-description', {
    subject,
    prompt,
  });
  return response.data;
};

// supabase
export const getTicketDescriptionImages = async (ticketId) => {
  const res = await apiClient.get(`/tickets/${ticketId}/description/images`);
  return res.data;
};

export const uploadTicketDescriptionImages = async (ticketId, files) => {
  const fd = new FormData();
  files.forEach((f) => fd.append('images', f));
  const res = await apiClient.post(`/tickets/${ticketId}/description/images`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deleteTicketDescriptionImage = async (ticketId, imageId) => {
  const res = await apiClient.delete(`/tickets/${ticketId}/description/images/${imageId}`);
  return res.data;
};
