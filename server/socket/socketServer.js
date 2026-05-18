const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Ticket = require('../models/Ticket');

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
  return normalizeBearerToken(cookies.accessToken) || normalizeBearerToken(cookies.token) || null;
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

  io.on('connection', async (socket) => {
    socket.use(([event, ...args], next) => {
      try {
        const token = extractTokenFromHandshake(socket);

        if (!token) {
          return next(new Error('unauthorized'));
        }

        jwt.verify(token, process.env.JWT_SECRET);

        next();
      } catch (error) {
        next(new Error('unauthorized'));
      }
    });

    const userId = socket.data?.userId;
    if (userId) {
      socket.join(getUserRoomName(userId));
      const workspaceRoomNames = await getUserWorkspaceRoomNames(userId);
      workspaceRoomNames.forEach((roomName) => socket.join(roomName));
    }

    socket.on('join_ticket', async ({ ticketId } = {}) => {
      const canJoin = await canUserJoinTicketRoom(userId, ticketId);
      if (canJoin) {
        socket.join(getTicketRoomName(ticketId));
      }
    });

    socket.on('leave_ticket', ({ ticketId } = {}) => {
      if (ticketId) {
        socket.leave(getTicketRoomName(ticketId));
      }
    });

    socket.on('join_workspace', async ({ workspaceId } = {}) => {
      const canJoin = await canUserJoinWorkspaceRoom(userId, workspaceId);
      if (canJoin) {
        socket.join(getWorkspaceRoomName(workspaceId));
      }
    });

    socket.on('leave_workspace', ({ workspaceId } = {}) => {
      if (workspaceId) {
        socket.leave(getWorkspaceRoomName(workspaceId));
      }
    });

    socket.on('error', (err) => {
      if (err.message === 'unauthorized') {
        socket.disconnect();
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
    const [user, workspaces] = await Promise.all([
      User.findById(userId).select('workspaceId').lean(),
      Workspace.find({
        isArchived: { $ne: true },
        members: {
          $elemMatch: {
            user: userId,
            status: 'active',
          },
        },
      })
        .select('_id')
        .lean(),
    ]);

    const workspaceIds = new Set(
      workspaces.map((workspace) => String(workspace._id)).filter(Boolean)
    );

    if (user?.workspaceId) {
      workspaceIds.add(String(user.workspaceId));
    }

    return [...workspaceIds].map(getWorkspaceRoomName);
  } catch (error) {
    return [];
  }
};

const canUserJoinWorkspaceRoom = async (userId, workspaceId) => {
  if (!userId || !workspaceId) return false;

  try {
    const user = await User.findById(userId).select('role workspaceId').lean();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.workspaceId && String(user.workspaceId) === String(workspaceId)) return true;

    const workspace = await Workspace.findOne({
      _id: workspaceId,
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

    return Boolean(workspace);
  } catch (error) {
    return false;
  }
};

const canUserJoinTicketRoom = async (userId, ticketId) => {
  if (!userId || !ticketId) return false;

  try {
    const [user, ticket] = await Promise.all([
      User.findById(userId).select('role workspaceId').lean(),
      Ticket.findById(ticketId).select('workspace').lean(),
    ]);

    if (!user || !ticket) return false;
    if (user.role === 'admin') return true;

    const workspaceId = String(ticket.workspace);
    if (user.workspaceId && String(user.workspaceId) === workspaceId) return true;

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      members: {
        $elemMatch: {
          user: userId,
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

module.exports = {
  initSocket,
  sendToUser,
  isUserOnline,
  broadcastToUserRoom,
  broadcastToWorkspace,
  broadcastToTicket,
  broadcastToWorkspaceAndTicket,
};
