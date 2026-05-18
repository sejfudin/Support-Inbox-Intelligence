import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { NOTIFICATIONS_QUERY_KEY } from '@/queries/notifications';
import { setActiveSocketId } from '@/lib/socketSession';
import { invalidateScopes, invalidateUserScope } from '@/lib/invalidationScopes';

const SocketContext = createContext(null);

const getAccessToken = () => localStorage.getItem('accessToken') || '';

const getSocketUrl = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL;

  if (!apiBase) {
    return window.location.origin;
  }

  try {
    const parsed = new URL(apiBase, window.location.origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (error) {
    return window.location.origin;
  }
};

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [accessToken, setAccessToken] = useState(getAccessToken);
  const socketRef = useRef(null);
  const tokenRef = useRef(accessToken);

  useEffect(() => {
    const syncToken = () => {
      const nextToken = getAccessToken();
      setAccessToken((currentToken) => (currentToken === nextToken ? currentToken : nextToken));
    };

    const intervalId = window.setInterval(syncToken, 1000);
    window.addEventListener('storage', syncToken);
    window.addEventListener('focus', syncToken);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', syncToken);
      window.removeEventListener('focus', syncToken);
    };
  }, []);

  useEffect(() => {
    const shouldConnect = isAuthenticated && !!accessToken;

    if (!shouldConnect) {
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      tokenRef.current = '';
      setIsConnected(false);
      return;
    }

    if (!socketRef.current) {
      const socket = io(getSocketUrl(), {
        autoConnect: false,
        withCredentials: true,
        transports: ['websocket', 'polling'],
        auth: {
          token: accessToken,
        },
      });

      const onConnect = () => {
        setIsConnected(true);
        setActiveSocketId(socket.id);
      };

      const onDisconnect = (reason) => {
        setIsConnected(false);
        setActiveSocketId(null);
      };

      const onConnectError = (error) => {
        if (error.message === 'unauthorized' || error.message === 'Authentication error') {
          setTimeout(() => {
            socket.connect();
          }, 1000);
        }
      };

      const onNewNotification = (payload) => {
        invalidateScopes(queryClient, payload?.scopes);
        invalidateUserScope(queryClient, payload?.recipientId);
      };

      const onCacheInvalidated = (payload) => {
        invalidateScopes(queryClient, payload?.scopes ?? payload?.scope);
      };

      const onWorkspaceTicketEvent = (payload) => {
        invalidateScopes(queryClient, payload?.scopes);
      };

      const onTicketCommentEvent = (payload) => {
        invalidateScopes(queryClient, payload?.scopes);

        if (payload?.commentId) {
          queryClient.invalidateQueries({
            queryKey: ['comment-images', String(payload.commentId)],
          });
        }
      };

      const onNotificationMarkedAsRead = (payload) => {
        invalidateScopes(queryClient, payload?.scopes);

        const notificationIds = Array.isArray(payload?.notificationIds)
          ? payload.notificationIds.map((id) => String(id))
          : payload?.notificationId
            ? [String(payload.notificationId)]
            : [];

        if (notificationIds.length === 0) {
          return;
        }

        const idSet = new Set(notificationIds);

        queryClient.setQueriesData({ queryKey: NOTIFICATIONS_QUERY_KEY }, (currentData) => {
          if (!currentData || !Array.isArray(currentData.data)) {
            return currentData;
          }

          let changedUnreadItems = 0;
          const nextItems = currentData.data.map((notification) => {
            const notificationId = String(notification?._id || notification?.id || '');

            if (!idSet.has(notificationId) || notification.read) {
              return notification;
            }

            changedUnreadItems += 1;
            return {
              ...notification,
              read: true,
            };
          });

          if (changedUnreadItems === 0) {
            return currentData;
          }

          const nextUnreadCount = Math.max(
            (Number(currentData.unreadCount) || 0) - changedUnreadItems,
            0
          );

          return {
            ...currentData,
            data: nextItems,
            unreadCount: nextUnreadCount,
          };
        });
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on('new_notification', onNewNotification);
      socket.on('CACHE_INVALIDATED', onCacheInvalidated);
      socket.on('ticket:created', onWorkspaceTicketEvent);
      socket.on('ticket:updated', onWorkspaceTicketEvent);
      socket.on('ticket:archived', onWorkspaceTicketEvent);
      socket.on('ticket:moved', onWorkspaceTicketEvent);
      socket.on('ticket:assigned', onWorkspaceTicketEvent);
      socket.on('comment:created', onTicketCommentEvent);
      socket.on('comment:updated', onTicketCommentEvent);
      socket.on('comment:deleted', onTicketCommentEvent);
      socket.on('NOTIFICATION_MARKED_AS_READ', onNotificationMarkedAsRead);

      socketRef.current = socket;
      tokenRef.current = accessToken;
    }

    const socket = socketRef.current;
    const tokenChanged = tokenRef.current !== accessToken;

    if (tokenChanged && socket) {
      tokenRef.current = accessToken;
      socket.auth = {
        ...(socket.auth || {}),
        token: accessToken,
      };
    }

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      if (!isAuthenticated || !accessToken) {
        socket.off();
        socket.disconnect();
        socketRef.current = null;
        tokenRef.current = '';
        setActiveSocketId(null);
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      tokenRef.current = '';
      setActiveSocketId(null);
      setIsConnected(false);
    };
  }, []);

  const value = useMemo(
    () => ({
      socket: socketRef.current,
      isConnected,
    }),
    [isConnected]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }

  return context;
};
