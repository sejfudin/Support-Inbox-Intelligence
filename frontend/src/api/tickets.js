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
export const createTicket = async (ticketData) => {
  const response = await apiClient.post("/tickets", ticketData);
  return response.data;
};
