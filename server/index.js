require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require('cors');
const cookieParser = require('cookie-parser');


const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/ticket");
const adminRoutes = require("./routes/admin");

const PORT = process.env.PORT || 4000;

const app = express();

const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);


(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🟢 Server is running at port: ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  }
})();
