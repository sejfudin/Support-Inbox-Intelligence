const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

const parseCookieHeader = (cookieHeader = '') => {
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex === -1) return acc;

      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!key) return acc;

      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
};

const normalizeBearerToken = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('Bearer ')) {
    return value.slice(7).trim() || null;
  }
  return value.trim() || null;
};

const extractTokenFromHandshake = (socket) => {
  const authToken = normalizeBearerToken(socket.handshake?.auth?.token);
  if (authToken) return authToken;

  const cookieHeader = socket.handshake?.headers?.cookie;
  if (!cookieHeader) return null;

  const cookies = parseCookieHeader(cookieHeader);
  return (
    normalizeBearerToken(cookies.accessToken) ||
    normalizeBearerToken(cookies.token) ||
    null
  );
};

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    try {
      const token = extractTokenFromHandshake(socket);
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const decodedUserId = decoded?.id || decoded?._id || decoded?.userId;

      if (!decodedUserId) {
        return next(new Error('Authentication error'));
      }

      socket.data.userId = String(decodedUserId);
      return next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data?.userId;

    if (userId) {
      socket.join(`user:${userId}`);
    }
  });

  return io;
};

const getUserRoomName = (userId) => `user:${String(userId)}`;

const isUserOnline = async (userId) => {
  if (!io) {
    return false;
  }

  const sockets = await io.in(getUserRoomName(userId)).fetchSockets();
  return sockets.length > 0;
};

const sendToUser = async (userId, eventName, data) => {
  if (!io) {
    return false;
  }

  const roomName = getUserRoomName(userId);
  const online = await isUserOnline(userId);

  if (!online) {
    return false;
  }

  try {
    io.to(roomName).emit(eventName, data);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  initSocket,
  sendToUser,
  isUserOnline,
};
