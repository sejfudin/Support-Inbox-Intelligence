const { Server } = require('socket.io');

let io;
const userSocketMap = {};

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on('register_user', (userId) => {
      if (!userId) {
        console.log(`[socket] register_user skipped for socket ${socket.id}: missing userId`);
        return;
      }

      const normalizedUserId = String(userId);
      userSocketMap[normalizedUserId] = socket.id;
      socket.data.userId = normalizedUserId;

      console.log(`[socket] user registered: userId=${normalizedUserId}, socketId=${socket.id}`);
    });

    socket.on('disconnect', (reason) => {
      const { userId } = socket.data || {};

      if (userId && userSocketMap[userId] === socket.id) {
        delete userSocketMap[userId];
        console.log(`[socket] user removed from map: userId=${userId}, socketId=${socket.id}`);
      }

      console.log(`[socket] disconnected: ${socket.id}, reason=${reason}`);
    });
  });

  return io;
};

const sendToUser = (userId, eventName, data) => {
  if (!io) {
    console.log('[socket] sendToUser skipped: io is not initialized');
    return false;
  }

  const socketId = userSocketMap[String(userId)];
  if (!socketId) {
    console.log(`[socket] sendToUser skipped: user ${userId} is offline`);
    return false;
  }

  io.to(socketId).emit(eventName, data);
  console.log(`[socket] sent event "${eventName}" to user ${userId} on socket ${socketId}`);
  return true;
};

module.exports = {
  initSocket,
  sendToUser,
  userSocketMap,
};
