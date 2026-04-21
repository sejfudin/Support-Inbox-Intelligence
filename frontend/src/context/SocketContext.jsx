import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { NOTIFICATIONS_QUERY_KEY } from "@/queries/notifications";

const SocketContext = createContext(null);

const getSocketUrl = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL;

  if (!apiBase) {
    return window.location.origin;
  }

  try {
    const parsed = new URL(apiBase, window.location.origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (error) {
    console.log("[socket] Failed to parse VITE_API_BASE_URL, fallback to current origin", error);
    return window.location.origin;
  }
};

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(getSocketUrl(), {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      console.log(`[socket] Connected: ${socket.id}`);
    };

    const onDisconnect = (reason) => {
      setIsConnected(false);
      console.log(`[socket] Disconnected: ${reason}`);
    };

    const onConnectError = (error) => {
      console.log("[socket] Connection error:", error.message);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    const userId = user?._id || user?.id;

    if (!socket) {
      return;
    }

    if (!isAuthenticated || !userId) {
      if (socket.connected) {
        socket.disconnect();
      }
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const registerCurrentUser = () => {
      socket.emit("register_user", String(userId));
      console.log(`[socket] register_user emitted for user ${userId}`);
    };

    registerCurrentUser();
    socket.on("connect", registerCurrentUser);

    return () => {
      socket.off("connect", registerCurrentUser);
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    const onNewNotification = (payload) => {
      console.log("[socket] new_notification received:", payload);
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    };

    socket.on("new_notification", onNewNotification);

    return () => {
      socket.off("new_notification", onNewNotification);
    };
  }, []);

  const value = useMemo(
    () => ({
      socket: socketRef.current,
      isConnected,
    }),
    [isConnected],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }

  return context;
};
