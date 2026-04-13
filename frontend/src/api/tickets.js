import apiClient from "./axios";

export const getAllTickets = async ({
  page,
  limit,
  search,
  status,
  priority,
  archived,
  workspaceId,
  sortBy,
  sortOrder,
} = {}) => {
  const response = await apiClient.get("/tickets", {
    params: {
      page,
      limit,
      search,
      status,
      priority,
      archived,
      workspaceId,
      sortBy,
      sortOrder,
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
  const response = await apiClient.post("/tickets", ticketData);
  return response.data;
};

export const updateTicket = async (ticketId, updates) => {
  const response = await apiClient.patch(`/tickets/${ticketId}`, updates);
  return response.data;
};

export const archiveTicket = async (ticketId) => {
  const response = await apiClient.patch(`/tickets/${ticketId}/archive`);
  return response.data;
};

export const getMyTickets = async ({
  page,
  limit,
  search,
  status,
  priority,
  sortBy,
  sortOrder,
} = {}) => {
  const response = await apiClient.get("/tickets/my-tickets", {
    params: { page, limit, search, status, priority, sortBy, sortOrder },
  });
  return response.data;
};