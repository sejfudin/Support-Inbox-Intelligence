require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/ticket");
const aiRoutes = require("./routes/ai");
const adminRoutes = require("./routes/admin");

const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use('/auth', authRoutes);
app.use('/tickets', ticketRoutes);
app.use('/', aiRoutes);
app.use('/admin', adminRoutes);


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
