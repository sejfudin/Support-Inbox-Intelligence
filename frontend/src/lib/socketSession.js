let activeSocketId = null;

export const setActiveSocketId = (socketId) => {
  if (!socketId || typeof socketId !== "string") {
    activeSocketId = null;
    return;
  }

  const trimmed = socketId.trim();
  activeSocketId = trimmed || null;
};

export const getActiveSocketId = () => activeSocketId;
