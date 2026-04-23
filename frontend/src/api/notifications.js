import apiClient from "./axios";
import { getActiveSocketId } from "@/lib/socketSession";

const buildSocketAwareConfig = () => {
  const socketId = getActiveSocketId();
  if (!socketId) {
    return undefined;
  }

  return {
    headers: {
      "x-socket-id": socketId,
    },
  };
};

export const getNotifications = async (params = {}) => {
  const response = await apiClient.get("/notifications", { params });
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await apiClient.patch(
    `/notifications/${id}/read`,
    undefined,
    buildSocketAwareConfig(),
  );
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await apiClient.patch(
    "/notifications/read-all",
    undefined,
    buildSocketAwareConfig(),
  );
  return response.data;
};
