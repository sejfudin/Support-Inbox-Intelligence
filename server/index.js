require("dotenv").config();
const express = require("express");
const http = require("http");
const connectDB = require("./config/db");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initSocket } = require('./socket/socketServer');

const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/ticket");
const adminRoutes = require("./routes/admin");
const workspaceRoutes = require("./routes/workspace");
const invitationRoutes = require("./routes/invitation");
const commentRoutes = require("./routes/comment");
const githubRoutes = require("./routes/github");
const analyticsRoutes = require("./routes/analytics");
const { handleWebhook } = require("./controllers/github");

const PORT = process.env.PORT || 4000;

const app = express();

const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

app.use(cors(corsOptions));

app.post('/api/webhooks/github', express.raw({ type: 'application/json' }), handleWebhook);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/comment', commentRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

(async () => {
  try {
    await connectDB();
    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      console.log(`🟢 Server is running at port: ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  }
})();
