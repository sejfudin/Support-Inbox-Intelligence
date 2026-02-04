import apiClient from "./axios";

export const getAllTickets = async ({ page, limit, search, status }) => {
  const response = await apiClient.get("/tickets", {
    params: {
      page,
      limit,
      search,
      status,
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
