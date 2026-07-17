const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Ticket = require('../models/Ticket');

let io;
const JOIN_RATE_LIMIT = {
  limit: 30,
  windowMs: 60 * 1000,
};

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
  return normalizeBearerToken(cookies.accessToken) || normalizeBearerToken(cookies.token) || null;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

const isActiveUser = (user) => Boolean(user?.active) && user?.status === 'active';

const authenticateSocket = async (socket) => {
  const token = extractTokenFromHandshake(socket);
  if (!token) {
    throw new Error('Authentication error');
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const decodedUserId = decoded?.id || decoded?._id || decoded?.userId;

  if (!decodedUserId || !isValidObjectId(decodedUserId)) {
    throw new Error('Authentication error');
  }

  const user = await User.findById(decodedUserId)
    .select('_id role workspaceId tokenVersion active status')
    .lean();

  if (!user || !isActiveUser(user)) {
    throw new Error('Authentication error');
  }

  if (decoded.tokenVersion !== user.tokenVersion) {
    throw new Error('Authentication error');
  }

  socket.data.userId = String(user._id);
  socket.data.authUser = user;

  return user;
};

const consumeRateLimit = (socket, key, { limit, windowMs } = JOIN_RATE_LIMIT) => {
  const now = Date.now();
  const bucketKey = `rateLimit:${key}`;
  const bucket = socket.data[bucketKey] || { count: 0, resetAt: now + windowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  socket.data[bucketKey] = bucket;

  return bucket.count <= limit;
};

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      await authenticateSocket(socket);
      return next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data?.userId;
    if (userId) {
      socket.join(getUserRoomName(userId));
      const workspaceRoomNames = await getUserWorkspaceRoomNames(userId);
      workspaceRoomNames.forEach((roomName) => socket.join(roomName));
    }

    socket.on('join_ticket', async ({ ticketId } = {}) => {
      if (!consumeRateLimit(socket, 'join_ticket') || !isValidObjectId(ticketId)) {
        return;
      }

      const canJoin = await canUserJoinTicketRoom(socket.data.authUser, ticketId);
      if (canJoin) {
        socket.join(getTicketRoomName(ticketId));
      }
    });

    socket.on('leave_ticket', ({ ticketId } = {}) => {
      if (isValidObjectId(ticketId)) {
        socket.leave(getTicketRoomName(ticketId));
      }
    });

    socket.on('join_workspace', async ({ workspaceId } = {}) => {
      if (!consumeRateLimit(socket, 'join_workspace') || !isValidObjectId(workspaceId)) {
        return;
      }

      const canJoin = await canUserJoinWorkspaceRoom(socket.data.authUser, workspaceId);
      if (canJoin) {
        socket.join(getWorkspaceRoomName(workspaceId));
      }
    });

    socket.on('leave_workspace', ({ workspaceId } = {}) => {
      if (isValidObjectId(workspaceId)) {
        socket.leave(getWorkspaceRoomName(workspaceId));
      }
    });
  });

  return io;
};

const getUserRoomName = (userId) => `user:${String(userId)}`;
const getWorkspaceRoomName = (workspaceId) => `workspace:${String(workspaceId)}`;
const getTicketRoomName = (ticketId) => `ticket:${String(ticketId)}`;

const getUserWorkspaceRoomNames = async (userId) => {
  try {
    const workspaces = await Workspace.find({
      isArchived: { $ne: true },
      members: {
        $elemMatch: {
          user: userId,
          status: 'active',
        },
      },
    })
      .select('_id')
      .lean();

    const workspaceIds = new Set(
      workspaces.map((workspace) => String(workspace._id)).filter(Boolean)
    );

    return [...workspaceIds].map(getWorkspaceRoomName);
  } catch (error) {
    return [];
  }
};

const canUserJoinWorkspaceRoom = async (user, workspaceId) => {
  if (!user || !workspaceId || !isValidObjectId(workspaceId)) return false;

  try {
    if (user.role === 'admin') return true;
    if (user.workspaceId && String(user.workspaceId) === String(workspaceId)) return true;

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isArchived: { $ne: true },
      members: {
        $elemMatch: {
          user: user._id,
          status: 'active',
        },
      },
    })
      .select('_id')
      .lean();

    return Boolean(workspace);
  } catch (error) {
    return false;
  }
};

const canUserJoinTicketRoom = async (user, ticketId) => {
  if (!user || !ticketId || !isValidObjectId(ticketId)) return false;

  try {
    const ticket = await Ticket.findById(ticketId).select('workspace').lean();

    if (!ticket) return false;
    if (user.role === 'admin') return true;

    const workspaceId = String(ticket.workspace);
    if (user.workspaceId && String(user.workspaceId) === workspaceId) return true;

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      members: {
        $elemMatch: {
          user: user._id,
          status: 'active',
        },
      },
    })
      .select('_id')
      .lean();

    return Boolean(workspace);
  } catch (error) {
    return false;
  }
};

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

  try {
    io.to(roomName).emit(eventName, data);
    return true;
  } catch (error) {
    return false;
  }
};

const broadcastToAll = (eventName, data) => {
  if (!io) {
    return false;
  }

  try {
    io.emit(eventName, data);
    return true;
  } catch (error) {
    return false;
  }
};

const broadcastToUserRoom = (userId, eventName, data, { excludeSocketId } = {}) => {
  if (!io) {
    return false;
  }

  const roomName = getUserRoomName(userId);

  try {
    if (excludeSocketId) {
      io.to(roomName).except(excludeSocketId).emit(eventName, data);
    } else {
      io.to(roomName).emit(eventName, data);
    }

    return true;
  } catch (error) {
    return false;
  }
};

const broadcastToWorkspace = (workspaceId, eventName, data, { excludeSocketId } = {}) => {
  if (!io || !workspaceId) {
    return false;
  }

  const roomName = getWorkspaceRoomName(workspaceId);

  try {
    if (excludeSocketId) {
      io.to(roomName).except(excludeSocketId).emit(eventName, data);
    } else {
      io.to(roomName).emit(eventName, data);
    }

    return true;
  } catch (error) {
    return false;
  }
};

const broadcastToTicket = (ticketId, eventName, data, { excludeSocketId } = {}) => {
  if (!io || !ticketId) {
    return false;
  }

  const roomName = getTicketRoomName(ticketId);

  try {
    if (excludeSocketId) {
      io.to(roomName).except(excludeSocketId).emit(eventName, data);
    } else {
      io.to(roomName).emit(eventName, data);
    }

    return true;
  } catch (error) {
    return false;
  }
};

const broadcastToWorkspaceAndTicket = (
  workspaceId,
  ticketId,
  eventName,
  data,
  { excludeSocketId } = {}
) => {
  if (!io || !workspaceId || !ticketId) {
    return false;
  }

  try {
    const target = io.to(getWorkspaceRoomName(workspaceId)).to(getTicketRoomName(ticketId));

    if (excludeSocketId) {
      target.except(excludeSocketId).emit(eventName, data);
    } else {
      target.emit(eventName, data);
    }

    return true;
  } catch (error) {
    return false;
  }
};

const broadcastToWorkspaceTicketAndUsers = (
  workspaceId,
  ticketId,
  userIds = [],
  eventName,
  data,
  { excludeSocketId } = {}
) => {
  if (!io || !workspaceId || !ticketId) {
    return false;
  }

  try {
    const roomNames = [
      getWorkspaceRoomName(workspaceId),
      getTicketRoomName(ticketId),
      ...new Set((userIds || []).filter(Boolean).map((userId) => getUserRoomName(userId))),
    ];

    const target = roomNames.reduce((chain, roomName) => chain.to(roomName), io);

    if (excludeSocketId) {
      target.except(excludeSocketId).emit(eventName, data);
    } else {
      target.emit(eventName, data);
    }

    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  initSocket,
  sendToUser,
  isUserOnline,
  broadcastToAll,
  broadcastToUserRoom,
  broadcastToWorkspace,
  broadcastToTicket,
  broadcastToWorkspaceAndTicket,
  broadcastToWorkspaceTicketAndUsers,
};
